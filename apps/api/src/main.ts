import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const appConfig = configService.get<AppConfig>('app', { infer: true });

  if (!appConfig) {
    throw new Error('Application configuration is missing');
  }

  const { port, cors, swagger, trustProxyHops } = appConfig;

  // Trust proxy solo la cantidad configurada de hops (0 = sin proxy, cliente directo).
  // Evita que un cliente forje X-Forwarded-For y bypasee el rate limiting.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', trustProxyHops);

  // Security headers
  app.use(helmet());

  app.enableCors({
    origin: cors.origins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  setupSwagger(app, swagger.enabled, swagger.path);

  await app.listen(port);
}

bootstrap();
