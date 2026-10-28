import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import { AdminGuard, CurrentUser, publicUser, SessionUser } from './auth';
import { PrismaService } from './prisma.service';

export class AdminListQuery {
  @IsString() @Length(0, 100) search = '';
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
export class AdminUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 60)
  @Matches(/\S/)
  name!: string;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(3, 254)
  email!: string;
  @IsBoolean() isAdmin!: boolean;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users') async users(@Query() query: AdminListQuery) {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: { ...publicUser, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * 20,
        take: 20,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: 20 };
  }

  @Patch('users/:id') async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUserDto,
    @CurrentUser() user: SessionUser,
  ) {
    if (id === user.id && !dto.isAdmin)
      throw new BadRequestException('Нельзя снять права администратора у себя');
    try {
      return await this.prisma.user.update({
        where: { id },
        data: dto,
        select: publicUser,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Этот email уже зарегистрирован');
        if (error.code === 'P2025') throw new NotFoundException();
      }
      throw error;
    }
  }

  @Get('posts') async posts(@Query() query: AdminListQuery) {
    const where: Prisma.PostWhereInput = query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { cat: { name: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          body: true,
          isPrivate: true,
          createdAt: true,
          cat: {
            select: {
              id: true,
              name: true,
              owner: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * 20,
        take: 20,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: 20 };
  }
}
