import { Injectable } from '@nestjs/common';
import type { MeDto } from '@yantramitra/shared-types';
import type { changePasswordSchema, loginSchema, registerSchema, z } from '@yantramitra/shared-validation';
import { AppError } from '../../common/app-error.js';
import type { AuthUser } from '../../common/auth.decorators.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toMe } from '../users/users.service.js';
import { LoginThrottleService } from './login-throttle.service.js';
import { PasswordService } from './password.service.js';
import { SessionService, type ClientType, type IssuedTokens } from './session.service.js';

export interface ClientContext {
  clientType: ClientType;
  ip: string;
  userAgent?: string;
}
export interface AuthResult {
  tokens: IssuedTokens;
  user: MeDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly throttle: LoginThrottleService,
  ) {}

  async register(input: z.output<typeof registerSchema>, ctx: ClientContext): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { fullName: input.fullName, mobile: input.mobile, passwordHash, preferredLocale: input.preferredLocale },
          include: { admin: true },
        });
        return { user: toMe(user), tokens: await this.sessions.create(user.id, ctx.clientType, ctx.userAgent, tx) };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new AppError(409, 'REGISTRATION_UNAVAILABLE', 'Registration is not possible with these details.');
      throw e;
    }
  }

  async login(input: z.output<typeof loginSchema>, ctx: ClientContext): Promise<AuthResult> {
    await this.throttle.attempt(input.mobile, ctx.ip);
    const user = await this.prisma.user.findUnique({ where: { mobile: input.mobile }, include: { admin: true } });
    const valid = await this.passwords.verify(user?.passwordHash, input.password);
    if (!user || !valid || user.status === 'deleted') throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect mobile number or password.');
    await this.throttle.clear(input.mobile, ctx.ip);

    // From here the caller has proven the password, so specific answers leak nothing.
    if (user.status !== 'active') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended.');
    if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt <= new Date())
      throw new AppError(403, 'TEMP_PASSWORD_EXPIRED', 'The temporary password has expired.');

    const tokens = await this.sessions.create(user.id, ctx.clientType, ctx.userAgent);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user: toMe(user), tokens };
  }

  async refresh(token: string, clientType: ClientType): Promise<AuthResult> {
    const { userId, ...tokens } = await this.sessions.rotate(token, clientType);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { admin: true } });
    return { user: toMe(user), tokens };
  }

  async changePassword(auth: AuthUser, input: z.output<typeof changePasswordSchema>, ctx: ClientContext): Promise<AuthResult> {
    await this.throttle.attempt(`change:${auth.id}`, ctx.ip);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.id } });
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword)))
      throw new AppError(400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
    if (input.currentPassword === input.newPassword)
      throw new AppError(400, 'PASSWORD_UNCHANGED', 'The new password must be different.');
    await this.throttle.clear(`change:${auth.id}`, ctx.ip);

    const passwordHash = await this.passwords.hash(input.newPassword);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: auth.id },
        data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false, tempPasswordExpiresAt: null },
        include: { admin: true },
      });
      // Signs out every other device; this one continues with a new session.
      await this.sessions.revokeAll(auth.id, 'password_changed', tx);
      return { user: toMe(updated), tokens: await this.sessions.create(auth.id, ctx.clientType, ctx.userAgent, tx) };
    });
  }
}
