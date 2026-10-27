import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {
  AuthGuard,
  CurrentUser,
  OptionalAuthGuard,
  SessionUser,
  publicUser,
  sessionToken,
} from './auth';
import { CatDto, LoginDto, PostDto, RegisterDto, SubscribeDto } from './dto';
import { config } from './config';
import { hasPaidAccess } from './access';
import { PrismaService } from './prisma.service';
import { PaypalService } from './paypal.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller()
export class ApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get('health') async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      payments: 'paypal-sandbox',
      paypalConfigured: this.paypal.configured,
    };
  }

  private setSession(res: Response, user: SessionUser) {
    res.cookie('onlycats_session', sessionToken(user), {
      httpOnly: true,
      sameSite: config.cookieSameSite,
      secure: config.cookieSecure,
      maxAge: 7 * 86400000,
      path: '/',
    });
  }

  @Post('auth/register') async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new BadRequestException('Пароль должен занимать не более 72 байт');
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          name: dto.name.trim(),
          passwordHash: await bcrypt.hash(dto.password, 12),
          loginEvents: {
            create: { kind: 'REGISTER', ...this.loginMetadata(req) },
          },
        },
        select: publicUser,
      });
      this.setSession(res, user);
      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Этот email уже зарегистрирован');
      throw error;
    }
  }

  @Post('auth/login') @HttpCode(200) async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    // A fixed valid hash makes unknown-account attempts perform the same expensive comparison.
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ||
        '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
    );
    if (!user || !valid)
      throw new BadRequestException('Неверный email или пароль');
    const safe = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    await this.prisma.loginEvent.create({
      data: { userId: user.id, kind: 'LOGIN', ...this.loginMetadata(req) },
    });
    this.setSession(res, safe);
    return safe;
  }
  private loginMetadata(req: Request) {
    // Forwarded addresses are honored only when Express trust proxy is explicitly configured.
    return {
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userAgent: req.get('user-agent')?.slice(0, 512) || null,
    };
  }

  @Get('account/login-history') @UseGuards(AuthGuard) async loginHistory(
    @CurrentUser() user: SessionUser,
  ) {
    return this.prisma.loginEvent.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        kind: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  }
  @Post('auth/logout') @HttpCode(200) logout(
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('onlycats_session', { path: '/' });
    return { ok: true };
  }
  @Get('auth/me') @UseGuards(OptionalAuthGuard) me(
    @CurrentUser() user?: SessionUser,
  ) {
    return user || null;
  }

  @Get('cats') async cats(@Query('search') search = '') {
    return this.prisma.cat.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search.slice(0, 100) } },
              {
                breed: { contains: search.slice(0, 100) },
              },
            ],
          }
        : {},
      include: {
        owner: { select: { name: true } },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  @Get('cats/:id') @UseGuards(OptionalAuthGuard) async cat(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: SessionUser,
  ) {
    const cat = await this.prisma.cat.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true } },
        _count: { select: { posts: true } },
      },
    });
    if (!cat) throw new NotFoundException('Кот не найден');
    const sub = user
      ? await this.prisma.subscription.findUnique({
          where: { userId_catId: { userId: user.id, catId: id } },
        })
      : null;
    return {
      ...cat,
      isOwner: user?.id === cat.ownerId,
      subscribed: hasPaidAccess(sub),
    };
  }
  @Post('cats') @UseGuards(AuthGuard) createCat(
    @CurrentUser() user: SessionUser,
    @Body() dto: CatDto,
  ) {
    if (dto.avatar?.startsWith('/api/'))
      throw new BadRequestException('Выберите изображение');
    return this.prisma.cat.create({ data: { ...dto, ownerId: user.id } });
  }
  private async ownCat(id: string, user: SessionUser) {
    const cat = await this.prisma.cat.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Кот не найден');
    if (cat.ownerId !== user.id && user.role !== 'ADMIN')
      throw new ForbiddenException('Это не ваш кот');
    return cat;
  }
  @Patch('cats/:id') @UseGuards(AuthGuard) async updateCat(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: CatDto,
  ) {
    const current = await this.ownCat(id, user);
    if (dto.avatar?.startsWith('/api/') && dto.avatar !== current.avatar)
      throw new BadRequestException('Выберите изображение');
    return this.prisma.cat.update({ where: { id }, data: dto });
  }

  @Get('cats/:id/posts') @UseGuards(OptionalAuthGuard) async posts(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: SessionUser,
  ) {
    const cat = await this.prisma.cat.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Кот не найден');
    const sub = user
      ? await this.prisma.subscription.findUnique({
          where: { userId_catId: { userId: user.id, catId: id } },
        })
      : null;
    const allowed =
      user?.id === cat.ownerId || user?.role === 'ADMIN' || hasPaidAccess(sub);
    const posts = await this.prisma.post.findMany({
      where: { catId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: user?.id || '' }, select: { userId: true } },
      },
    });
    return posts.map((post) => {
      const locked = post.isPrivate && !allowed;
      return {
        id: post.id,
        catId: id,
        cat,
        liked: post.likes.length > 0,
        likes: post._count.likes,
        comments: post._count.comments,
        title: post.title,
        body: locked ? null : post.body,
        isPrivate: post.isPrivate,
        locked,
        createdAt: post.createdAt,
        imageUrl:
          !locked && post.imageKey ? `/api/posts/${post.id}/image` : null,
      };
    });
  }
  @Post('cats/:id/posts') @UseGuards(AuthGuard) async createPost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: PostDto,
  ) {
    await this.ownCat(id, user);
    return this.prisma.post.create({ data: { ...dto, catId: id } });
  }
  @Patch('posts/:id') @UseGuards(AuthGuard) async editPost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: PostDto,
  ) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException();
    await this.ownCat(post.catId, user);
    return this.prisma.post.update({ where: { id }, data: dto });
  }
  @Delete('posts/:id') @UseGuards(AuthGuard) async deletePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException();
    await this.ownCat(post.catId, user);
    await this.prisma.post.delete({ where: { id } });
    if (post.imageKey)
      await this.prisma.storedImage.deleteMany({
        where: { id: post.imageKey },
      });
    return { ok: true };
  }
  @Post('posts/:id/image')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException();
    await this.ownCat(post.catId, user);
    const image = await this.decodeImage(file);
    await this.prisma.$transaction(async (tx) => {
      const stored = await tx.storedImage.create({
        data: { data: new Uint8Array(image) },
      });
      const current = await tx.post.findUniqueOrThrow({ where: { id } });
      await tx.post.update({ where: { id }, data: { imageKey: stored.id } });
      if (current.imageKey)
        await tx.storedImage.deleteMany({ where: { id: current.imageKey } });
    });
    return { imageUrl: `/api/posts/${id}/image` };
  }
  @Get('posts/:id/image') @UseGuards(OptionalAuthGuard) async image(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser | undefined,
    @Res() res: Response,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { cat: true },
    });
    if (!post?.imageKey) throw new NotFoundException();
    if (
      post.isPrivate &&
      user?.id !== post.cat.ownerId &&
      user?.role !== 'ADMIN'
    ) {
      const sub = user
        ? await this.prisma.subscription.findUnique({
            where: { userId_catId: { userId: user.id, catId: post.catId } },
          })
        : null;
      if (!hasPaidAccess(sub))
        throw new ForbiddenException('Нужна активная подписка');
    }
    res.setHeader('Cache-Control', 'private, no-store');
    const stored = await this.prisma.storedImage.findUnique({
      where: { id: post.imageKey },
    });
    if (!stored) throw new NotFoundException();
    res.type('image/jpeg').send(Buffer.from(stored.data));
  }

  private async decodeImage(file?: Express.Multer.File): Promise<Buffer> {
    if (!file) throw new BadRequestException('Выберите изображение');
    let image: Buffer;
    try {
      const decoded = sharp(file.buffer, { limitInputPixels: 25000000 });
      const metadata = await decoded.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format || ''))
        throw new Error('Unsupported image format');
      image = await decoded
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Нужна фотография JPEG, PNG или WebP до 8 МБ',
      );
    }
    return image;
  }
  @Post('cats/:id/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.ownCat(id, user);
    const image = await this.decodeImage(file);
    const stored = await this.prisma.$transaction(async (tx) => {
      const stored = await tx.storedImage.create({
        data: { data: new Uint8Array(image) },
      });
      const cat = await tx.cat.findUniqueOrThrow({ where: { id } });
      await tx.cat.update({
        where: { id },
        data: { avatar: '/api/cats/' + id + '/avatar?v=' + stored.id },
      });
      const old = cat.avatar.match(/\?v=([a-f0-9-]+)$/)?.[1];
      if (old) await tx.storedImage.deleteMany({ where: { id: old } });
      return stored;
    });
    return { avatar: '/api/cats/' + id + '/avatar?v=' + stored.id };
  }
  @Get('cats/:id/avatar')
  async avatar(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const cat = await this.prisma.cat.findUnique({ where: { id } });
    const key = cat?.avatar.match(/\?v=([a-f0-9-]+)$/)?.[1];
    const image = key
      ? await this.prisma.storedImage.findUnique({ where: { id: key } })
      : null;
    if (!image) throw new NotFoundException();
    res.setHeader('Cache-Control', 'no-store');
    res.type('image/jpeg').send(Buffer.from(image.data));
  }

  @Get('account') @UseGuards(AuthGuard) async account(
    @CurrentUser() user: SessionUser,
  ) {
    const [cats, subscriptions] = await Promise.all([
      this.prisma.cat.findMany({
        where: { ownerId: user.id },
        include: { _count: { select: { posts: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.findMany({
        where: { userId: user.id },
        include: { cat: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { user, cats, subscriptions };
  }
  @Post('subscriptions') @UseGuards(AuthGuard) checkout(
    @CurrentUser() user: SessionUser,
    @Body() dto: SubscribeDto,
  ) {
    return this.subscriptions.checkout(user.id, dto.catId);
  }
  @Post('subscriptions/confirm/:paypalId') @UseGuards(AuthGuard) confirm(
    @CurrentUser() user: SessionUser,
    @Param('paypalId') paypalId: string,
  ) {
    if (!/^I-[A-Z0-9]+$/.test(paypalId))
      throw new BadRequestException('Некорректный ID подписки');
    return this.subscriptions.confirm(user.id, paypalId);
  }
  @Post('subscriptions/:id/sync') @UseGuards(AuthGuard) sync(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subscriptions.sync(id, user.id);
  }
  @Delete('subscriptions/:id') @UseGuards(AuthGuard) cancel(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subscriptions.cancel(user.id, id);
  }
  @Post('payments/paypal/webhook') @HttpCode(200) webhook(
    @Headers() headers: Request['headers'],
    @Body() event: Record<string, unknown>,
  ) {
    return this.subscriptions.webhook(headers, event);
  }

  @Get('admin/users') @UseGuards(AuthGuard) async adminUsers(
    @CurrentUser() user: SessionUser,
  ) {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    return this.prisma.user.findMany({
      select: {
        ...publicUser,
        createdAt: true,
        _count: { select: { cats: true, subscriptions: true } },
      },
      take: 100,
    });
  }
  @Get('admin/withdrawals') @UseGuards(AuthGuard) async adminWithdrawals(
    @CurrentUser() user: SessionUser,
  ) {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    return this.prisma.withdrawalRequest.findMany({
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        createdAt: true,
        owner: { select: publicUser },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
