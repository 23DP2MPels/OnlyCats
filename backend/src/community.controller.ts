import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthGuard, CurrentUser, SessionUser } from './auth';
import { PrismaService } from './prisma.service';
import { PaypalService } from './paypal.service';
import { SubscriptionsService } from './subscriptions.service';
import { DeleteAccountDto, GiftDto } from './dto';

const publicCat = {
  id: true,
  name: true,
  breed: true,
  bio: true,
  avatar: true,
  ownerId: true,
  createdAt: true,
  _count: { select: { posts: true } },
  owner: { select: { name: true } },
} as const;
@Controller()
export class CommunityController {
  constructor(
    private readonly db: PrismaService,
    private readonly paypal: PaypalService,
    private readonly subscriptions: SubscriptionsService,
  ) {}
  @Get('search') async search(@Query('q') query = '') {
    const q = query.trim().slice(0, 100);
    if (q.length < 2) return { users: [], cats: [] };
    const [users, cats] = await Promise.all([
      this.db.user.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        select: { id: true, name: true, _count: { select: { cats: true } } },
        take: 20,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.db.cat.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        select: publicCat,
        take: 20,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return { users, cats };
  }
  @Get('users/:id') async profile(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        cats: { select: publicCat, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }
  @Post('cats/:id/gifts')
  @UseGuards(AuthGuard)
  async gift(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: GiftDto,
  ) {
    const cat = await this.db.cat.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException();
    if (cat.ownerId !== user.id) throw new ForbiddenException('Это не ваш кот');
    if (dto.userId === user.id)
      throw new BadRequestException('Выберите другого пользователя');
    if (
      !(await this.db.user.findUnique({
        where: { id: dto.userId },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
    const giftUntil = new Date(Date.now() + 30 * 86400000);
    const sub = await this.db.subscription.upsert({
      where: { userId_catId: { userId: dto.userId, catId: id } },
      update: { giftUntil },
      create: { userId: dto.userId, catId: id, giftUntil },
    });
    return { id: sub.id, giftUntil: sub.giftUntil };
  }
  @Delete('account')
  @UseGuards(AuthGuard)
  async remove(
    @CurrentUser() user: SessionUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const existing = await this.db.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (!(await bcrypt.compare(dto.password, existing.passwordHash)))
      throw new BadRequestException('Неверный пароль');
    const related = {
      OR: [{ userId: user.id }, { cat: { ownerId: user.id } }],
    };
    // Confirm cancellation with the provider before erasing the local bindings.
    const subs = await this.db.subscription.findMany({ where: related });
    for (const sub of subs)
      if (sub.paypalId) {
        const remote = await this.paypal.details(sub.paypalId);
        if (!['CANCELLED', 'EXPIRED'].includes(remote.status))
          await this.paypal.cancel(sub.paypalId);
      }
    await this.db.$transaction(async (tx) => {
      const cats = await tx.cat.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          avatar: true,
          posts: { select: { imageKey: true } },
        },
      });
      const imageIds = cats
        .flatMap((c) => [
          ...c.posts.map((p) => p.imageKey),
          c.avatar.match(/\?v=([^&]+)$/)?.[1],
        ])
        .filter((x): x is string => !!x);
      const subIds = subs.map((s) => s.id);
      await tx.ownerPayment.deleteMany({
        where: {
          OR: [{ ownerId: user.id }, { subscriptionId: { in: subIds } }],
        },
      });
      await tx.withdrawalRequest.deleteMany({ where: { ownerId: user.id } });
      await tx.subscription.deleteMany({ where: related });
      await tx.cat.deleteMany({ where: { ownerId: user.id } });
      await tx.storedImage.deleteMany({ where: { id: { in: imageIds } } });
      await tx.user.delete({ where: { id: user.id } });
    });
    res.clearCookie('onlycats_session', { path: '/' });
    return { ok: true };
  }
}
