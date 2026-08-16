import './instrument';

import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadApiConfig } from '@thriftage/config/api';
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

  await app.listen(config.port, config.host);
  logger.log(`API listening on ${await app.getUrl()}`);
}

void bootstrap();
