import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadEnv } from './config/env.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Entry point for serverless hosts (Vercel). The Nest app is created once per function instance
 * and reused by every request that instance serves; `main.ts` remains the entry for long-running servers.
 */
let ready: Promise<Handler> | undefined;

async function create(): Promise<Handler> {
  const env = loadEnv();
  if (env.SENTRY_DSN) Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0 });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  configureApp(app, env);
  await app.init();
  return app.getHttpAdapter().getInstance() as Handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  ready ??= create().catch((error: unknown) => {
    ready = undefined; // let the next request retry instead of caching the failure
    throw error;
  });
  (await ready)(req, res);
}
