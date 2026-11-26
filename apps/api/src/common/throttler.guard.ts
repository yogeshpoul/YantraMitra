import { timingSafeEqual } from 'node:crypto';
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { loadEnv } from '../config/env.js';

/** IP rate limiting. Server-side rendering calls carry an internal key and are exempt. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly internalKey = loadEnv().INTERNAL_API_KEY;

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const given = context.switchToHttp().getRequest<Request>().headers['x-internal-key'];
    if (!this.internalKey || typeof given !== 'string') return false;
    const a = Buffer.from(given);
    const b = Buffer.from(this.internalKey);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
