import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@yantramitra/shared-types';

export class AppError extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message, status);
  }
}

export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const forbidden = (message = 'Not allowed') => new AppError(403, 'FORBIDDEN', message);
export const invalidField = (field: string, key = 'invalid') =>
  new AppError(400, 'VALIDATION_FAILED', 'Validation failed', { [field]: key });
