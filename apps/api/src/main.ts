import './instrument';

import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadApiConfig } from '@thriftage/config/api';
import { getPrismaClient } from '@thriftage/db';
import { API_SERVICE_NAME, API_VERSION_PREFIX } from '@thriftage/shared';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { ErrorCaptureInterceptor } from './observability/error-capture.interceptor';
import { requestLoggingMiddleware } from './observability/request-logging.middleware';

async function bootstrap(): Promise<void> {
  const config = loadApiConfig(process.env);
  const logger = new ConsoleLogger(API_SERVICE_NAME, {
    json: config.logFormat === 'json',
    timestamp: true,
  });
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(logger);
  app.use(requestLoggingMiddleware);
  app.use(helmet());
  app.enableCors({
    credentials: true,
    origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : false,
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix(API_VERSION_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalInterceptors(new ErrorCaptureInterceptor());

  // Establish the remote pool before Nest starts worker lifecycle hooks. A cold
  // TLS connection can otherwise consume Prisma's short transaction wait and
  // make the first outbox/finalization poll fail during every deployment.
  await getPrismaClient(process.env.DATABASE_URL, {
    max: config.databasePoolMax,
  }).$queryRaw`SELECT 1`;
  await app.listen(config.port, config.host);
  logger.log(`API listening on ${await app.getUrl()}`);
}

void bootstrap();
