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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma } from '@prisma/client';
import { AuthGuard, CurrentUser, OptionalAuthGuard, SessionUser } from './auth';
import { PrismaService } from './prisma.service';
import { hasPaidAccess } from './access';
import { CommentDto } from './dto';

@Controller()
export class SocialController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('feed')
  @UseGuards(OptionalAuthGuard)
  async feed(
    @CurrentUser() user: SessionUser | undefined,
    @Query('scope') scope = 'all',
    @Query('cursor') cursor?: string,
  ) {
    if (
      !['all', 'subscriptions'].includes(scope) ||
      (cursor && !isUUID(cursor))
    )
      throw new BadRequestException('Некорректные параметры ленты');
    if (scope === 'subscriptions' && !user)
      throw new ForbiddenException('Войдите в аккаунт');
    const active = {
      userId: user?.id || '',
      OR: [
        {
          status: { in: ['ACTIVE', 'CANCELLED'] as ('ACTIVE' | 'CANCELLED')[] },
          paidUntil: { gt: new Date() },
        },
        { giftUntil: { gt: new Date() } },
      ],
    };
    const where: Prisma.PostWhereInput =
      scope === 'subscriptions'
        ? { cat: { subscriptions: { some: active } } }
        : {};
    if (
      cursor &&
      !(await this.prisma.post.findFirst({
        where: { ...where, id: cursor },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Некорректные параметры ленты');
    const rows = await this.prisma.post.findMany({
      where,
      take: 21,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        cat: {
          include: {
            owner: { select: { name: true } },
            subscriptions: { where: active, select: { id: true } },
          },
        },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: user?.id || '' }, select: { userId: true } },
      },
    });
    const items = rows.slice(0, 20).map((post) => {
      const allowed =
        user?.isAdmin ||
        user?.id === post.cat.ownerId ||
        post.cat.subscriptions.length > 0;
      const locked = post.isPrivate && !allowed;
      const { subscriptions, ...cat } = post.cat;
      return {
        id: post.id,
        catId: post.catId,
        cat,
        title: post.title,
        body: locked ? null : post.body,
        imageUrl:
          !locked && post.imageKey ? `/api/posts/${post.id}/image` : null,
        createdAt: post.createdAt,
        isPrivate: post.isPrivate,
        locked,
        liked: post.likes.length > 0,
        likes: post._count.likes,
        comments: post._count.comments,
      };
    });
    return { items, nextCursor: rows.length > 20 ? items.at(-1)!.id : null };
  }

  private async accessible(id: string, user?: SessionUser) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { cat: { select: { ownerId: true } } },
    });
    if (!post) throw new NotFoundException();
    if (post.isPrivate && !user?.isAdmin && user?.id !== post.cat.ownerId) {
      const sub = user
        ? await this.prisma.subscription.findUnique({
            where: { userId_catId: { userId: user.id, catId: post.catId } },
          })
        : null;
      if (!hasPaidAccess(sub))
        throw new ForbiddenException('Нужна активная подписка');
    }
    return post;
  }

  @Put('posts/:id/like')
  @UseGuards(AuthGuard)
  async like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.accessible(id, user);
    await this.prisma.like.upsert({
      where: { userId_postId: { userId: user.id, postId: id } },
      create: { userId: user.id, postId: id },
      update: {},
    });
    return {
      liked: true,
      likes: await this.prisma.like.count({ where: { postId: id } }),
    };
  }
  @Delete('posts/:id/like')
  @UseGuards(AuthGuard)
  async unlike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.prisma.like.deleteMany({
      where: { userId: user.id, postId: id },
    });
    return {
      liked: false,
      likes: await this.prisma.like.count({ where: { postId: id } }),
    };
  }
  @Get('posts/:id/comments')
  @UseGuards(OptionalAuthGuard)
  async comments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: SessionUser,
  ) {
    await this.accessible(id, user);
    return this.prisma.comment.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    });
  }
  @Post('posts/:id/comments')
  @UseGuards(AuthGuard)
  async comment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: CommentDto,
  ) {
    await this.accessible(id, user);
    return this.prisma.comment.create({
      data: { postId: id, userId: user.id, body: dto.body.trim() },
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    });
  }
}
