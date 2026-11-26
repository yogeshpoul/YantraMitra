import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, createListing, listingInput, register, resetDb, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => { ctx = await createApp(); });
afterAll(async () => { await ctx.app.close(); });
beforeEach(async () => { await resetDb(ctx.prisma); });

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('listing lifecycle', () => {
  it('creates a listing with operations and an initial location history entry in one transaction', async () => {
    const owner = await register(ctx);
    const created = await createListing(ctx, owner);
    expect(created.path).toMatch(/^\/equipment\/tractors\/tractor-with-rotavator-[0-9a-f-]{36}$/);
    expect(await ctx.prisma.listingOperation.count({ where: { listingId: created.id } })).toBe(1);
    expect(await ctx.prisma.locationHistory.count({ where: { listingId: created.id } })).toBe(1);
  });

  it('rejects a type from another category and unknown operations', async () => {
    const owner = await register(ctx);
    const input = await listingInput(ctx);
    const categories = (await ctx.http().get('/api/v1/categories')).body as { id: string; slug: string }[];
    const other = categories.find((c) => c.slug === 'irrigation')!;
    const res = await ctx.http().post('/api/v1/equipment').set(auth(owner.token)).send({ ...input, categoryId: other.id });
    expect(res.body.code).toBe('INVALID_CATALOGUE_REFERENCE');
    const ops = await ctx.http().post('/api/v1/equipment').set(auth(owner.token)).send({ ...input, operationIds: [crypto.randomUUID()] });
    expect(ops.status).toBe(400);
  });

  it('requires login to create', async () => {
    expect((await ctx.http().post('/api/v1/equipment').send(await listingInput(ctx))).status).toBe(401);
  });

  it('validates pricing consistency', async () => {
    const owner = await register(ctx);
    const res = await ctx.http().post('/api/v1/equipment').set(auth(owner.token)).send(await listingInput(ctx, { pricingType: 'contact_for_price', price: 500 }));
    expect(res.body.details.price).toBe('priceNotAllowed');
    const ok = await ctx.http().post('/api/v1/equipment').set(auth(owner.token)).send(await listingInput(ctx, { pricingType: 'contact_for_price', price: null }));
    expect(ok.status).toBe(201);
    expect(ok.body.pricing.price).toBeNull();
  });

  it('lets the owner edit and ignores fields that must not be client controlled', async () => {
    const owner = await register(ctx);
    const other = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const res = await ctx.http().patch(`/api/v1/equipment/${id}`).set(auth(owner.token))
      .send({ title: 'Updated tractor title', pricingType: 'per_acre', price: 1500, ownerId: other.userId, status: 'suspended' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Updated tractor title', status: 'active', pricing: { type: 'per_acre', price: 1500 } });
    const row = await ctx.prisma.equipmentListing.findUniqueOrThrow({ where: { id } });
    expect(row.ownerId).toBe(owner.userId);
  });

  it("never lets a user modify another user's listing", async () => {
    const owner = await register(ctx);
    const intruder = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const loc = { lat: 18.5, lng: 73.8, label: 'x' };
    for (const req of [
      ctx.http().patch(`/api/v1/equipment/${id}`).send({ title: 'Hijacked title' }),
      ctx.http().patch(`/api/v1/equipment/${id}/status`).send({ status: 'inactive' }),
      ctx.http().patch(`/api/v1/equipment/${id}/location`).send(loc),
      ctx.http().delete(`/api/v1/equipment/${id}`),
      ctx.http().get(`/api/v1/users/me/listings/${id}`),
    ]) {
      const res = await req.set(auth(intruder.token));
      expect([403, 404]).toContain(res.status);
    }
    expect((await ctx.prisma.equipmentListing.findUniqueOrThrow({ where: { id } })).title).toBe('Mahindra tractor with rotavator');
  });

  it('allows only defined status transitions', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const set = (status: string) => ctx.http().patch(`/api/v1/equipment/${id}/status`).set(auth(owner.token)).send({ status });
    expect((await set('unavailable')).body.status).toBe('unavailable');
    expect((await set('inactive')).body.status).toBe('inactive');
    expect((await set('active')).body.status).toBe('active');
    expect((await set('suspended')).status).toBe(400);
    await ctx.prisma.equipmentListing.update({ where: { id }, data: { status: 'suspended' } });
    const res = await set('active');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('soft-deletes, hiding the listing everywhere', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    expect((await ctx.http().delete(`/api/v1/equipment/${id}`).set(auth(owner.token))).status).toBe(204);
    const row = await ctx.prisma.equipmentListing.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('deleted');
    expect(row.deletedAt).not.toBeNull();
    expect((await ctx.http().get(`/api/v1/equipment/${id}`)).status).toBe(404);
    expect((await ctx.http().get('/api/v1/users/me/listings').set(auth(owner.token))).body.total).toBe(0);
    expect((await ctx.http().delete(`/api/v1/equipment/${id}`).set(auth(owner.token))).status).toBe(404);
  });

  it('inactive listings are hidden from the public but visible to the owner', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    await ctx.http().patch(`/api/v1/equipment/${id}/status`).set(auth(owner.token)).send({ status: 'inactive' });
    expect((await ctx.http().get(`/api/v1/equipment/${id}`)).status).toBe(404);
    expect((await ctx.http().get('/api/v1/equipment')).body.total).toBe(0);
    expect((await ctx.http().get('/api/v1/users/me/listings').set(auth(owner.token))).body.items[0].status).toBe('inactive');
  });
});

describe('favorites and reports', () => {
  it('saves and removes favorites idempotently', async () => {
    const owner = await register(ctx);
    const farmer = await register(ctx);
    const { id } = await createListing(ctx, owner);
    expect((await ctx.http().post(`/api/v1/equipment/${id}/favorite`)).status).toBe(401);
    await ctx.http().post(`/api/v1/equipment/${id}/favorite`).set(auth(farmer.token));
    await ctx.http().post(`/api/v1/equipment/${id}/favorite`).set(auth(farmer.token));
    const list = await ctx.http().get('/api/v1/users/me/favorites').set(auth(farmer.token));
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].id).toBe(id);
    await ctx.http().delete(`/api/v1/equipment/${id}/favorite`).set(auth(farmer.token));
    expect((await ctx.http().get('/api/v1/users/me/favorites/ids').set(auth(farmer.token))).body).toEqual([]);
  });

  it('accepts one open report per user and blocks self-reports', async () => {
    const owner = await register(ctx);
    const farmer = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const report = () => ctx.http().post(`/api/v1/equipment/${id}/reports`).set(auth(farmer.token)).send({ reason: 'fake', details: 'Not real' });
    expect((await report()).status).toBe(201);
    expect((await report()).body.code).toBe('ALREADY_REPORTED');
    const self = await ctx.http().post(`/api/v1/equipment/${id}/reports`).set(auth(owner.token)).send({ reason: 'fake' });
    expect(self.body.code).toBe('OWN_LISTING');
  });
});
