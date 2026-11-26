import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, createListing, makeAdmin, register, resetDb, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => { ctx = await createApp(); });
afterAll(async () => { await ctx.app.close(); });
beforeEach(async () => { await resetDb(ctx.prisma); });

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('contact owner', () => {
  it('guests cannot reveal the phone number', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const res = await ctx.http().get(`/api/v1/equipment/${id}/contact`);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(owner.mobile);
  });

  it('signed-in users get the number, a WhatsApp link, and the reveal is recorded', async () => {
    const owner = await register(ctx, { fullName: 'Ramesh Jadhav' });
    const farmer = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const res = await ctx.http().get(`/api/v1/equipment/${id}/contact`).set(auth(farmer.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ownerName: 'Ramesh', phone: owner.mobile, whatsappUrl: `https://wa.me/${owner.mobile.slice(1)}` });
    expect(res.headers['cache-control']).toContain('no-store');
    expect(await ctx.prisma.contactEvent.count({ where: { listingId: id, userId: farmer.userId, type: 'reveal' } })).toBe(1);
    await ctx.http().post(`/api/v1/equipment/${id}/contact-events`).set(auth(farmer.token)).send({ type: 'call_click' });
    expect(await ctx.prisma.contactEvent.count({ where: { type: 'call_click' } })).toBe(1);
    expect((await ctx.http().post(`/api/v1/equipment/${id}/contact-events`).set(auth(farmer.token)).send({ type: 'reveal' })).status).toBe(400);
  });

  it('respects disabled contact, inactive listings and suspended owners', async () => {
    const owner = await register(ctx);
    const farmer = await register(ctx);
    const disabled = await createListing(ctx, owner, { contactEnabled: false });
    expect((await ctx.http().get(`/api/v1/equipment/${disabled.id}/contact`).set(auth(farmer.token))).body.code).toBe('CONTACT_DISABLED');

    const unavailable = await createListing(ctx, owner);
    await ctx.http().patch(`/api/v1/equipment/${unavailable.id}/status`).set(auth(owner.token)).send({ status: 'unavailable' });
    expect((await ctx.http().get(`/api/v1/equipment/${unavailable.id}/contact`).set(auth(farmer.token))).body.code).toBe('LISTING_NOT_ACTIVE');

    const active = await createListing(ctx, owner);
    await ctx.prisma.user.update({ where: { id: owner.userId }, data: { status: 'suspended' } });
    expect((await ctx.http().get(`/api/v1/equipment/${active.id}/contact`).set(auth(farmer.token))).body.code).toBe('OWNER_UNAVAILABLE');
  });

  it('omits WhatsApp when the owner disallows it, and limits reveals per day', async () => {
    const owner = await register(ctx);
    const farmer = await register(ctx);
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push((await createListing(ctx, owner, { allowWhatsapp: false })).id);
    const reveal = (id: string) => ctx.http().get(`/api/v1/equipment/${id}/contact`).set(auth(farmer.token));
    expect((await reveal(ids[0]!)).body.whatsappUrl).toBeNull();
    await reveal(ids[1]!);
    await reveal(ids[2]!);
    expect((await reveal(ids[0]!)).status).toBe(200); // already revealed: does not count again
    expect((await reveal(ids[3]!)).status).toBe(429); // CONTACT_REVEALS_PER_DAY=3 in tests
  });
});

describe('admin', () => {
  it('denies admin endpoints to guests and ordinary users', async () => {
    const user = await register(ctx);
    expect((await ctx.http().get('/api/v1/admin/dashboard')).status).toBe(401);
    expect((await ctx.http().get('/api/v1/admin/dashboard').set(auth(user.token))).status).toBe(403);
    expect((await ctx.http().post('/api/v1/admin/categories').set(auth(user.token)).send({})).status).toBe(403);
  });

  it('suspends and restores a listing, with audit entries', async () => {
    const admin = await makeAdmin(ctx);
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const noReason = await ctx.http().patch(`/api/v1/admin/listings/${id}/status`).set(auth(admin.token)).send({ status: 'suspended' });
    expect(noReason.status).toBe(400);
    expect((await ctx.http().patch(`/api/v1/admin/listings/${id}/status`).set(auth(admin.token)).send({ status: 'suspended', reason: 'Fake listing' })).status).toBe(204);
    expect((await ctx.http().get(`/api/v1/equipment/${id}`)).status).toBe(404);
    const own = await ctx.http().get(`/api/v1/users/me/listings/${id}`).set(auth(owner.token));
    expect(own.body).toMatchObject({ status: 'suspended', suspendedReason: 'Fake listing' });
    expect((await ctx.http().patch(`/api/v1/equipment/${id}/status`).set(auth(owner.token)).send({ status: 'active' })).status).toBe(409);
    await ctx.http().patch(`/api/v1/admin/listings/${id}/status`).set(auth(admin.token)).send({ status: 'active' });
    expect((await ctx.http().get(`/api/v1/equipment/${id}`)).status).toBe(200);
    const logs = (await ctx.http().get('/api/v1/admin/audit-logs').set(auth(admin.token))).body;
    expect(logs.items.map((l: { action: string }) => l.action)).toEqual(['listing.restore', 'listing.suspend']);
    await expect(ctx.prisma.adminAuditLog.deleteMany()).rejects.toThrow();
  });

  it('suspends a user, ending their sessions immediately', async () => {
    const admin = await makeAdmin(ctx);
    const user = await register(ctx);
    await ctx.http().patch(`/api/v1/admin/users/${user.userId}/status`).set(auth(admin.token)).send({ status: 'suspended', reason: 'Spam' });
    expect((await ctx.http().get('/api/v1/auth/me').set(auth(user.token))).status).toBe(401);
    const login = await ctx.http().post('/api/v1/auth/login').set('X-Client-Type', 'native').send({ mobile: user.mobile, password: 'shetkari-42' });
    expect(login.body.code).toBe('ACCOUNT_SUSPENDED');
    // Admins cannot suspend administrators (including themselves) from the panel.
    const self = await ctx.http().patch(`/api/v1/admin/users/${admin.userId}/status`).set(auth(admin.token)).send({ status: 'suspended', reason: 'x' });
    expect(self.status).toBe(403);
  });

  it('issues a temporary password that must be changed and expires', async () => {
    const admin = await makeAdmin(ctx);
    const user = await register(ctx);
    const reset = await ctx.http().post(`/api/v1/admin/users/${user.userId}/password-reset`).set(auth(admin.token));
    expect(reset.status).toBe(200);
    const temp = reset.body.temporaryPassword as string;
    expect(temp).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect((await ctx.http().get('/api/v1/auth/me').set(auth(user.token))).status).toBe(401);

    const login = await ctx.http().post('/api/v1/auth/login').set('X-Client-Type', 'native').send({ mobile: user.mobile, password: temp });
    expect(login.body.user.mustChangePassword).toBe(true);
    const t = login.body.accessToken as string;
    expect((await ctx.http().get('/api/v1/users/me/listings').set(auth(t))).body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    const changed = await ctx.http().post('/api/v1/auth/change-password').set('X-Client-Type', 'native').set(auth(t))
      .send({ currentPassword: temp, newPassword: 'fresh-start-88', confirmPassword: 'fresh-start-88' });
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect((await ctx.http().get('/api/v1/users/me/listings').set(auth(changed.body.accessToken))).status).toBe(200);

    const again = await ctx.http().post(`/api/v1/admin/users/${user.userId}/password-reset`).set(auth(admin.token));
    await ctx.prisma.user.update({ where: { id: user.userId }, data: { tempPasswordExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await ctx.http().post('/api/v1/auth/login').set('X-Client-Type', 'native').send({ mobile: user.mobile, password: again.body.temporaryPassword });
    expect(expired.body.code).toBe('TEMP_PASSWORD_EXPIRED');
  });

  it('manages the catalogue; inactive entries disappear from public lists', async () => {
    const admin = await makeAdmin(ctx);
    const names = { en: 'Balers', mr: 'बेलर', hi: 'बेलर' };
    const created = await ctx.http().post('/api/v1/admin/categories').set(auth(admin.token)).send({ slug: 'balers', names, iconKey: 'other' });
    expect(created.status).toBe(201);
    expect((await ctx.http().post('/api/v1/admin/categories').set(auth(admin.token)).send({ slug: 'balers', names, iconKey: 'other' })).status).toBe(409);
    expect((await ctx.http().post('/api/v1/admin/categories').set(auth(admin.token)).send({ slug: 'near', names, iconKey: 'other' })).body.details.slug).toBe('slugReserved');
    const type = await ctx.http().post('/api/v1/admin/equipment-types').set(auth(admin.token)).send({ categoryId: created.body.id, slug: 'square-baler', names });
    expect(type.status).toBe(201);
    const op = await ctx.http().post('/api/v1/admin/operations').set(auth(admin.token)).send({ slug: 'baling', names });
    expect(op.status).toBe(201);
    expect((await ctx.http().get('/api/v1/categories')).body.some((c: { slug: string }) => c.slug === 'balers')).toBe(true);
    await ctx.http().patch(`/api/v1/admin/categories/${created.body.id}`).set(auth(admin.token)).send({ isActive: false });
    expect((await ctx.http().get('/api/v1/categories')).body.some((c: { slug: string }) => c.slug === 'balers')).toBe(false);
    await ctx.http().patch(`/api/v1/admin/operations/${op.body.id}`).set(auth(admin.token)).send({ names: { ...names, en: 'Hay baling' } });
    expect((await ctx.http().get('/api/v1/operations')).body.find((o: { slug: string }) => o.slug === 'baling').names.en).toBe('Hay baling');
  });

  it('moderates reports through allowed transitions', async () => {
    const admin = await makeAdmin(ctx);
    const owner = await register(ctx);
    const farmer = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const report = await ctx.http().post(`/api/v1/equipment/${id}/reports`).set(auth(farmer.token)).send({ reason: 'wrong_information' });
    const list = await ctx.http().get('/api/v1/admin/reports').query({ status: 'open' }).set(auth(admin.token));
    expect(list.body.items[0]).toMatchObject({ id: report.body.id, reason: 'wrong_information', listing: { id } });
    const set = (status: string) => ctx.http().patch(`/api/v1/admin/reports/${report.body.id}`).set(auth(admin.token)).send({ status, resolutionNote: 'Checked' });
    expect((await set('reviewing')).status).toBe(204);
    expect((await set('resolved')).status).toBe(204);
    expect((await set('reviewing')).status).toBe(409);
    expect((await ctx.http().get('/api/v1/admin/dashboard').set(auth(admin.token))).body.reports.open).toBe(0);
  });
});
