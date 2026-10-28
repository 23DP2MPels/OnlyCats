import { AdminController } from './admin.controller';
import { CommunityController } from './community.controller';
import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import express, { Request, Response, NextFunction } from 'express';
import { resolve } from 'node:path';
import { ApiController } from './api.controller';
import { SocialController } from './social.controller';
import { PrismaService } from './prisma.service';
import { AdminGuard, AuthGuard, OptionalAuthGuard } from './auth';
import { PaypalService } from './paypal.service';
import { SubscriptionsService } from './subscriptions.service';
import { config, validateConfig } from './config';
import { EarningsService } from './earnings.service';
import { CreatorController } from './creator.controller';
import { AccountController } from './account.controller';

@Module({
  controllers: [
    ApiController,
    AdminController,
    SocialController,
    CreatorController,
    AccountController,
    CommunityController,
  ],
  providers: [
    PrismaService,
    PaypalService,
    SubscriptionsService,
    EarningsService,
    AuthGuard,
    AdminGuard,
    OptionalAuthGuard,
  ],
})
class AppModule {}

async function bootstrap() {
  validateConfig();
  const app = await NestFactory.create(AppModule);
  if (config.trustProxy)
    app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxy);
  app.setGlobalPrefix('api');
  const apiOrigin = config.apiUrl.startsWith('http')
    ? new URL(config.apiUrl).origin
    : "'self'";
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'", apiOrigin],
          imgSrc: ["'self'", 'data:', apiOrigin],
          upgradeInsecureRequests: config.frontendUrl.startsWith('https://')
            ? []
            : null,
        },
      },
    }),
  );
  app.use(cookieParser());
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Browser mutation requests must come from our frontend. Server-to-server webhooks have no Origin.
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      !config.corsOrigins.includes(req.headers.origin)
    ) {
      res.status(403).json({ message: 'Недопустимый источник запроса' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('OnlyCats API')
      .setDescription(
        'Mācību projekts. Visi maksājumi notiek PayPal Sandbox vidē.',
      )
      .setVersion('0.1.0')
      .addCookieAuth('onlycats_session')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc);
  const server = app.getHttpAdapter().getInstance();
  server.get('/runtime-config.js', (_req: Request, res: Response) => {
    res
      .type('application/javascript')
      .send(
        `window.__ONLYCATS_CONFIG__ = ${JSON.stringify({ apiUrl: config.apiUrl }).replaceAll('<', '\\u003c')};`,
      );
  });
  if (config.frontendDist) {
    const frontendDist = resolve(config.frontendDist);
    server.use(express.static(frontendDist, { index: false }));
    server.get(/^(?!\/api(?:\/|$)).*/, (_req: Request, res: Response) => {
      res.sendFile(resolve(frontendDist, 'index.html'));
    });
  }
  await app.listen(config.port, '0.0.0.0');
}
bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
