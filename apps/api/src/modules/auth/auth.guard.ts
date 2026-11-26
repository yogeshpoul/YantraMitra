import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, forbidden } from '../../common/app-error.js';
import { ALLOW_PASSWORD_PENDING, IS_PUBLIC, type AuthedRequest } from '../../common/auth.decorators.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SessionService } from './session.service.js';

/** Global guard. Session, account status and password state are read on every request, so revocation is immediate. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    const claims = token ? await this.sessions.verifyAccess(token) : null;
    if (!claims) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');

    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      include: { user: { include: { admin: true } } },
    });
    if (!session || session.userId !== claims.sub || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'active')
      throw new AppError(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
    if (session.user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_PENDING, targets))
      throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password first.');

    const admin = session.user.admin;
    req.user = { id: session.userId, sessionId: session.id, adminId: admin?.isActive ? admin.id : null };
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!context.switchToHttp().getRequest<AuthedRequest>().user?.adminId) throw forbidden('Administrator access required');
    return true;
  }
}
