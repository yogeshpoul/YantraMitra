import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  sessionId: string;
  adminId: string | null;
}
export type AuthedRequest = Request & { user?: AuthUser; id?: string };

export const IS_PUBLIC = 'isPublic';
/** Routes are protected unless marked public. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_PASSWORD_PENDING = 'allowPasswordPending';
/** Usable while a temporary password still has to be replaced. */
export const AllowPasswordPending = () => SetMetadata(ALLOW_PASSWORD_PENDING, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new Error('CurrentUser used on a public route');
  return user;
});
