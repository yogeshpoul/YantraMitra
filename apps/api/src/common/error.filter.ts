import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { ApiErrorBody, ErrorCode } from '@yantramitra/shared-types';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from './app-error.js';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const body = this.toBody(exception);
    body.requestId = req.id;
    if (body.statusCode >= 500) {
      // The path only: query strings and bodies may hold personal data.
      this.logger.error(`${req.method} ${req.path} [${req.id}]`, exception instanceof Error ? exception.stack : String(exception));
      Sentry.captureException(exception, { tags: { requestId: req.id } });
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(e: unknown): ApiErrorBody {
    if (e instanceof AppError) return { statusCode: e.getStatus(), code: e.code, message: e.message, details: e.details };
    if (e instanceof HttpException) {
      const statusCode = e.getStatus();
      const code = CODE_BY_STATUS[statusCode] ?? 'INTERNAL_ERROR';
      const message = statusCode === 429 ? 'Too many requests' : statusCode >= 500 ? 'Internal server error' : e.message;
      return { statusCode, code, message };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return { statusCode: 409, code: 'CONFLICT', message: 'Already exists' };
      if (e.code === 'P2025') return { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' };
    }
    // body-parser errors (malformed JSON, payload too large)
    const status = (e as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500)
      return { statusCode: status, code: CODE_BY_STATUS[status] ?? 'VALIDATION_FAILED', message: 'Malformed request' };
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }
}
