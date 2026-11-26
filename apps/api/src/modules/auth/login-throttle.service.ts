import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const WINDOW_MINUTES = 15;
/** Per number and address: stops guessing. */
export const PAIR_LIMIT = 5;
/** Per number from anywhere: stops distributed guessing. Higher, so a stranger cannot easily lock an owner out. */
export const NUMBER_LIMIT = 50;

/** Database-backed, so it also holds across restarts and multiple API instances. */
@Injectable()
export class LoginThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  private keys(subject: string, ip: string): { key: string; limit: number }[] {
    const digest = (v: string) => createHash('sha256').update(v).digest('hex');
    return [
      { key: `p:${digest(`${subject}|${ip}`)}`, limit: PAIR_LIMIT },
      { key: `n:${digest(subject)}`, limit: NUMBER_LIMIT },
    ];
  }

  /**
   * Counts the attempt before the password is checked, so parallel guesses cannot slip through.
   * Behaves identically for numbers that have no account.
   */
  async attempt(subject: string, ip: string): Promise<void> {
    for (const { key, limit } of this.keys(subject, ip)) {
      const rows = await this.prisma.$queryRaw<{ failures: number }[]>`
        INSERT INTO login_throttles (key, failures, window_started_at) VALUES (${key}, 1, now())
        ON CONFLICT (key) DO UPDATE SET
          failures = CASE WHEN login_throttles.window_started_at < now() - make_interval(mins => ${WINDOW_MINUTES}) THEN 1
                          ELSE login_throttles.failures + 1 END,
          window_started_at = CASE WHEN login_throttles.window_started_at < now() - make_interval(mins => ${WINDOW_MINUTES}) THEN now()
                                   ELSE login_throttles.window_started_at END
        RETURNING failures`;
      if ((rows[0]?.failures ?? 0) > limit) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Try again later.');
    }
  }

  async clear(subject: string, ip: string): Promise<void> {
    await this.prisma.loginThrottle.deleteMany({ where: { key: { in: this.keys(subject, ip).map((k) => k.key) } } });
  }
}
