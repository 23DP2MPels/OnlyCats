import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { PrismaService } from './prisma.service';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};
export const publicUser = {
  id: true,
  email: true,
  name: true,
  isAdmin: true,
} as const;
export type AuthRequest = Request & { user?: SessionUser };
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthRequest>().user,
);

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();
    const token = request.cookies?.onlycats_session;
    if (!token) return true;
    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'onlycats',
        audience: 'onlycats-web',
      });
      if (typeof payload !== 'string' && typeof payload.sub === 'string') {
        request.user =
          (await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: publicUser,
          })) || undefined;
      }
    } catch {
      /* Expired or invalid sessions become anonymous. */
    }
    return true;
  }
}

@Injectable()
export class AuthGuard extends OptionalAuthGuard {
  async canActivate(ctx: ExecutionContext) {
    await super.canActivate(ctx);
    if (!ctx.switchToHttp().getRequest<AuthRequest>().user)
      throw new UnauthorizedException('Войдите в аккаунт');
    return true;
  }
}

export function sessionToken(user: SessionUser) {
  return jwt.sign({}, config.jwtSecret, {
    subject: user.id,
    expiresIn: '7d',
    algorithm: 'HS256',
    issuer: 'onlycats',
    audience: 'onlycats-web',
  });
}

@Injectable()
export class AdminGuard extends AuthGuard {
  async canActivate(ctx: ExecutionContext) {
    await super.canActivate(ctx);
    if (!ctx.switchToHttp().getRequest<AuthRequest>().user?.isAdmin)
      throw new ForbiddenException();
    return true;
  }
}
