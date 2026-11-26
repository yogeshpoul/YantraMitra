import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, MeDto } from '@yantramitra/shared-types';
import { changePasswordSchema, loginSchema, refreshSchema, registerSchema, type z } from '@yantramitra/shared-validation';
import type { Request, Response } from 'express';
import { AppError } from '../../common/app-error.js';
import { AllowPasswordPending, CurrentUser, Public, type AuthUser } from '../../common/auth.decorators.js';
import { ApiZod, zod } from '../../common/zod.js';
import { ENV, loadEnv, type Env } from '../../config/env.js';
import { UsersService } from '../users/users.service.js';
import { AuthService, type AuthResult, type ClientContext } from './auth.service.js';
import { SessionService } from './session.service.js';

const COOKIE = 'ym_rt';
const COOKIE_PATH = '/api/v1/auth';
const authLimit = () => loadEnv().AUTH_RATE_LIMIT_PER_MINUTE;
const AUTH_THROTTLE = { default: { ttl: 60_000, limit: authLimit } };

@ApiTags('auth')
@ApiHeader({ name: 'X-Client-Type', enum: ['web', 'native'], required: true })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Register with mobile number and password' })
  @ApiZod({ body: registerSchema })
  async register(@Body(zod(registerSchema)) body: z.output<typeof registerSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const ctx = this.context(req);
    return this.respond(await this.auth.register(body, ctx), ctx, res);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in' })
  @ApiZod({ body: loginSchema })
  async login(@Body(zod(loginSchema)) body: z.output<typeof loginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const ctx = this.context(req);
    return this.respond(await this.auth.login(body, ctx), ctx, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token. Web: HttpOnly cookie. Native: request body.' })
  @ApiZod({ body: refreshSchema })
  async refresh(@Body(zod(refreshSchema)) body: z.output<typeof refreshSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const ctx = this.context(req);
    const token = this.refreshToken(req, ctx, body.refreshToken);
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Not signed in');
    try {
      return this.respond(await this.auth.refresh(token, ctx.clientType), ctx, res);
    } catch (e) {
      if (e instanceof AppError && e.getStatus() === 401 && ctx.clientType === 'web') this.clearCookie(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiZod({ body: refreshSchema })
  async logout(@Body(zod(refreshSchema)) body: z.output<typeof refreshSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const ctx = this.context(req);
    const token = this.refreshToken(req, ctx, body.refreshToken);
    if (token) await this.sessions.revokeByRefreshToken(token);
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    const claims = bearer ? await this.sessions.verifyAccess(bearer) : null;
    if (claims) await this.sessions.revoke(claims.sid, 'logout');
    if (ctx.clientType === 'web') this.clearCookie(res);
  }

  @AllowPasswordPending()
  @ApiBearerAuth()
  @Throttle(AUTH_THROTTLE)
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change password; signs out all other devices' })
  @ApiZod({ body: changePasswordSchema })
  async changePassword(
    @CurrentUser() user: AuthUser, @Body(zod(changePasswordSchema)) body: z.output<typeof changePasswordSchema>,
    @Req() req: Request, @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const ctx = this.context(req);
    return this.respond(await this.auth.changePassword(user, body, ctx), ctx, res);
  }

  @AllowPasswordPending()
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current user' })
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.users.me(user.id);
  }

  /** The custom header also blocks cross-site form posts against the cookie endpoints. */
  private context(req: Request): ClientContext {
    const type = req.headers['x-client-type'];
    if (type !== 'web' && type !== 'native') throw new AppError(400, 'VALIDATION_FAILED', 'X-Client-Type header is required');
    return { clientType: type, ip: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] };
  }

  /** Native clients can never use the cookie, so a script cannot exchange it for a readable token. */
  private refreshToken(req: Request, ctx: ClientContext, fromBody?: string): string | undefined {
    if (ctx.clientType === 'native') return fromBody;
    const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  private respond({ tokens, user }: AuthResult, ctx: ClientContext, res: Response): AuthResponse {
    const response: AuthResponse = { accessToken: tokens.accessToken, accessTokenExpiresIn: tokens.expiresIn, user };
    if (tokens.refreshToken) {
      if (ctx.clientType === 'native') response.refreshToken = tokens.refreshToken;
      else res.cookie(COOKIE, tokens.refreshToken, { ...this.cookieOptions(), maxAge: this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
    }
    res.setHeader('Cache-Control', 'no-store');
    return response;
  }

  private clearCookie(res: Response): void {
    res.clearCookie(COOKIE, this.cookieOptions());
  }

  private cookieOptions() {
    return { httpOnly: true, sameSite: 'lax' as const, secure: this.env.NODE_ENV === 'production', path: COOKIE_PATH };
  }
}
