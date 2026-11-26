import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  if (env.SENTRY_DSN) {
    // Optional. Personal data is not sent.
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0 });
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : undefined,
  });
  configureApp(app, env);
  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`API listening on :${env.PORT}${env.SWAGGER_ENABLED ? ` (docs at /api/docs)` : ''}`);
}

void bootstrap();
