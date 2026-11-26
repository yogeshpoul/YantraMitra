import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../../common/app-error.js';
import { ENV, type Env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type ClientType = 'web' | 'native';
export interface AccessClaims {
  sub: string;
  sid: string;
}
export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  /** null when the presented refresh token stays valid */
  refreshToken: string | null;
}

const REUSE_GRACE_MS = 60_000;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const expired = () => new AppError(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(userId: string, clientType: ClientType, userAgent: string | undefined, tx: Prisma.TransactionClient = this.prisma): Promise<IssuedTokens> {
    const secret = randomBytes(32).toString('base64url');
    const session = await tx.session.create({
      data: { userId, clientType, refreshHash: sha256(secret), userAgent: userAgent?.slice(0, 200), expiresAt: this.refreshExpiry() },
    });
    return this.issue(userId, session.id, secret);
  }

  /**
   * Rotates the refresh token. Presenting an already rotated token revokes the session, except for a
   * short grace period that covers parallel tabs and responses lost on poor connections.
   */
  async rotate(token: string, clientType: ClientType): Promise<IssuedTokens & { userId: string }> {
    const [sessionId, presented] = token.split('.');
    if (!sessionId || !presented || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw expired();
    const presentedHash = sha256(presented);
    const secret = randomBytes(32).toString('base64url');
    const now = new Date();

    const updated = await this.prisma.session.updateMany({
      where: { id: sessionId, clientType, refreshHash: presentedHash, revokedAt: null, expiresAt: { gt: now } },
      data: { refreshHash: sha256(secret), previousRefreshHash: presentedHash, rotatedAt: now, expiresAt: this.refreshExpiry() },
    });
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= now || session.clientType !== clientType) throw expired();
    if (session.user.status !== 'active') throw expired();
    if (updated.count === 1) return { userId: session.userId, ...(await this.issue(session.userId, sessionId, secret)) };

    if (session.previousRefreshHash === presentedHash && now.getTime() - session.rotatedAt.getTime() < REUSE_GRACE_MS) {
      if (clientType === 'web') {
        // Another tab already received the new cookie.
        return { userId: session.userId, ...(await this.issue(session.userId, sessionId, null)) };
      }
      const swapped = await this.prisma.session.updateMany({
        where: { id: sessionId, refreshHash: session.refreshHash, revokedAt: null },
        data: { refreshHash: sha256(secret) },
      });
      if (swapped.count === 1) return { userId: session.userId, ...(await this.issue(session.userId, sessionId, secret)) };
      throw expired();
    }
    await this.revoke(sessionId, 'refresh_reuse');
    throw expired();
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
  }

  /** Proves possession of the refresh token before revoking. */
  async revokeByRefreshToken(token: string): Promise<void> {
    const [sessionId, secret] = token.split('.');
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/i.test(sessionId)) return;
    const hash = sha256(secret);
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null, OR: [{ refreshHash: hash }, { previousRefreshHash: hash }] },
      data: { revokedAt: new Date(), revokedReason: 'logout' },
    });
  }

  async revokeAll(userId: string, reason: string, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
  }

  async verifyAccess(token: string): Promise<AccessClaims | null> {
    try {
      return await this.jwt.verifyAsync<AccessClaims>(token);
    } catch {
      return null;
    }
  }

  private async issue(userId: string, sessionId: string, secret: string | null): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: sessionId });
    return { accessToken, expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS, refreshToken: secret ? `${sessionId}.${secret}` : null };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }
}
