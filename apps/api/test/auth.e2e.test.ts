import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PAIR_LIMIT } from '../src/modules/auth/login-throttle.service.js';
import { createApp, register, resetDb, uniqueMobile, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => { ctx = await createApp(); });
afterAll(async () => { await ctx.app.close(); });
beforeEach(async () => { await resetDb(ctx.prisma); });

const login = (mobile: string, password: string, client = 'native') =>
  ctx.http().post('/api/v1/auth/login').set('X-Client-Type', client).send({ mobile, password });

describe('registration', () => {
  it('registers, normalises the number and stores only an Argon2id hash', async () => {
    const res = await ctx.http().post('/api/v1/auth/register').set('X-Client-Type', 'native').send({
      fullName: 'Asha Patil', mobile: '098765 43210', password: 'shetkari-42', confirmPassword: 'shetkari-42', preferredLocale: 'hi',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ mobile: '+919876543210', preferredLocale: 'hi', isAdmin: false });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { mobile: '+919876543210' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain('shetkari-42');
  });

  it('enforces unique mobile numbers regardless of formatting', async () => {
    await register(ctx, { mobile: '9876543210' });
    const res = await ctx.http().post('/api/v1/auth/register').set('X-Client-Type', 'native').send({
      fullName: 'Someone Else', mobile: '+91 98765-43210', password: 'another-pass-9', confirmPassword: 'another-pass-9', preferredLocale: 'en',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REGISTRATION_UNAVAILABLE');
  });

  it('returns field-level validation keys', async () => {
    const res = await ctx.http().post('/api/v1/auth/register').set('X-Client-Type', 'native')
      .send({ fullName: 'A', mobile: '123', password: 'x', confirmPassword: 'y', preferredLocale: 'xx' });
    expect(res.status).toBe(400);
    expect(res.body.details).toMatchObject({ fullName: 'tooShort', mobile: 'phoneInvalid', password: 'passwordTooShort', preferredLocale: 'invalid' });
  });

  it('requires the client type header', async () => {
    const res = await ctx.http().post('/api/v1/auth/login').send({ mobile: '9876543210', password: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  it('signs in with the correct password', async () => {
    const s = await register(ctx);
    const res = await login(s.mobile, 'shetkari-42');
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('gives the same generic error for a wrong password and an unknown number', async () => {
    const s = await register(ctx);
    const wrong = await login(s.mobile, 'not-the-password');
    const unknown = await login(uniqueMobile(), 'not-the-password');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('locks out repeated failures, then also refuses the correct password', async () => {
    const s = await register(ctx);
    for (let i = 0; i < PAIR_LIMIT; i++) expect((await login(s.mobile, `wrong-${i}`)).status).toBe(401);
    const blocked = await login(s.mobile, 'shetkari-42');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('web clients get an HttpOnly refresh cookie and never a readable refresh token', async () => {
    const s = await register(ctx);
    const res = await login(s.mobile, 'shetkari-42', 'web');
    expect(res.body.refreshToken).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/ym_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });
});

describe('sessions', () => {
  it('rotates refresh tokens and revokes the session when an old token is replayed later', async () => {
    const s = await register(ctx);
    const first = await ctx.http().post('/api/v1/auth/refresh').set('X-Client-Type', 'native').send({ refreshToken: s.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(s.refreshToken);
    // Simulate the replay happening after the grace period.
    await ctx.prisma.session.updateMany({ data: { rotatedAt: new Date(Date.now() - 5 * 60_000) } });
    const replay = await ctx.http().post('/api/v1/auth/refresh').set('X-Client-Type', 'native').send({ refreshToken: s.refreshToken });
    expect(replay.status).toBe(401);
    const after = await ctx.http().post('/api/v1/auth/refresh').set('X-Client-Type', 'native').send({ refreshToken: first.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it('a native refresh cannot use the web cookie', async () => {
    const s = await register(ctx);
    const web = await login(s.mobile, 'shetkari-42', 'web');
    const cookie = String(web.headers['set-cookie']).split(';')[0]!;
    const res = await ctx.http().post('/api/v1/auth/refresh').set('X-Client-Type', 'native').set('Cookie', cookie).send({});
    expect(res.status).toBe(401);
  });

  it('logout revokes access immediately', async () => {
    const s = await register(ctx);
    expect((await ctx.http().get('/api/v1/auth/me').set('Authorization', `Bearer ${s.token}`)).status).toBe(200);
    await ctx.http().post('/api/v1/auth/logout').set('X-Client-Type', 'native').set('Authorization', `Bearer ${s.token}`).send({ refreshToken: s.refreshToken });
    expect((await ctx.http().get('/api/v1/auth/me').set('Authorization', `Bearer ${s.token}`)).status).toBe(401);
  });

  it('rejects missing and forged tokens on protected routes', async () => {
    expect((await ctx.http().get('/api/v1/users/me')).status).toBe(401);
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwic2lkIjoieCJ9.invalid';
    expect((await ctx.http().get('/api/v1/users/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });
});

describe('password change', () => {
  it('requires the current password, then signs out other devices', async () => {
    const s = await register(ctx);
    const other = await login(s.mobile, 'shetkari-42');
    const bad = await ctx.http().post('/api/v1/auth/change-password').set('X-Client-Type', 'native').set('Authorization', `Bearer ${s.token}`)
      .send({ currentPassword: 'wrong', newPassword: 'new-secret-77', confirmPassword: 'new-secret-77' });
    expect(bad.body.code).toBe('CURRENT_PASSWORD_INCORRECT');

    const ok = await ctx.http().post('/api/v1/auth/change-password').set('X-Client-Type', 'native').set('Authorization', `Bearer ${s.token}`)
      .send({ currentPassword: 'shetkari-42', newPassword: 'new-secret-77', confirmPassword: 'new-secret-77' });
    expect(ok.status).toBe(200);
    expect((await ctx.http().get('/api/v1/auth/me').set('Authorization', `Bearer ${other.body.accessToken}`)).status).toBe(401);
    expect((await ctx.http().get('/api/v1/auth/me').set('Authorization', `Bearer ${ok.body.accessToken}`)).status).toBe(200);
    expect((await login(s.mobile, 'shetkari-42')).status).toBe(401);
    expect((await login(s.mobile, 'new-secret-77')).status).toBe(200);
  });

  it('profile updates cannot change the mobile number or privileges', async () => {
    const s = await register(ctx);
    const res = await ctx.http().patch('/api/v1/users/me').set('Authorization', `Bearer ${s.token}`)
      .send({ fullName: 'New Name', preferredLocale: 'en', mobile: '+919999999999', isAdmin: true, passwordHash: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fullName: 'New Name', preferredLocale: 'en', mobile: s.mobile, isAdmin: false });
  });
});
