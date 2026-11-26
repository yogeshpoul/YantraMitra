import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { ErrorFilter } from './common/error.filter.js';
import type { Env } from './config/env.js';

/** Shared by main.ts and the end-to-end tests, so tests run the real configuration. */
export function configureApp(app: INestApplication, env: Env): void {
  const express = app as NestExpressApplication;
  express.set('trust proxy', env.TRUST_PROXY_HOPS);
  express.disable('x-powered-by');
  express.useBodyParser('json', { limit: '100kb' });

  app.use((req: Request & { id?: string }, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    req.id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });
  // JSON API: the strictest content security policy applies.
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(cookieParser());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Type', 'X-Request-Id'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('YantraMitra API')
      .setDescription('Peer-to-peer agricultural equipment marketplace. Error bodies: { statusCode, code, message, details?, requestId }.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    // Swagger UI needs inline scripts; relax the policy for the docs page only.
    app.use('/api/docs', helmet({ contentSecurityPolicy: false }));
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  }
}
