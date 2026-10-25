import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { ApiController } from './api.controller';
import { SocialController } from './social.controller';
import { PrismaService } from './prisma.service';
import { AuthGuard, OptionalAuthGuard } from './auth';
import { PaypalService } from './paypal.service';
import { SubscriptionsService } from './subscriptions.service';
import { config, validateConfig } from './config';

@Module({
  controllers: [ApiController, SocialController],
  providers: [
    PrismaService,
    PaypalService,
    SubscriptionsService,
    AuthGuard,
    OptionalAuthGuard,
  ],
})
class AppModule {}

async function bootstrap() {
  validateConfig();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.frontendUrl, credentials: true });
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
      req.headers.origin !== config.frontendUrl
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
      .setDescription('Учебный проект. Все платежи — PayPal Sandbox.')
      .setVersion('0.1.0')
      .addCookieAuth('onlycats_session')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc);
  await app.listen(config.port, '0.0.0.0');
}
bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
