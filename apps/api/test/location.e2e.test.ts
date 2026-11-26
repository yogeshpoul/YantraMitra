import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, createListing, register, resetDb, type Session, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => { ctx = await createApp(); });
afterAll(async () => { await ctx.app.close(); });
beforeEach(async () => { await resetDb(ctx.prisma); });

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const at = (lat: number, lng: number, label = 'Field') => ({ lat, lng, label, visibility: 'approximate', source: 'map' });

async function listingAt(s: Session, lat: number, lng: number, extra: Record<string, unknown> = {}) {
  return createListing(ctx, s, { current: at(lat, lng), home: { lat, lng, label: 'Home' }, ...extra });
}

describe('home and current locations', () => {
  it('stores them independently; updating current never moves home and appends history', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const before = (await ctx.http().get(`/api/v1/users/me/listings/${id}`).set(auth(owner.token))).body;
    expect(before.home).toMatchObject({ lat: 18.97123, lng: 76.95871 });
    expect(before.current).toMatchObject({ lat: 18.98317, lng: 76.94152 });

    const res = await ctx.http().patch(`/api/v1/equipment/${id}/location`).set(auth(owner.token)).send({ lat: 18.5204, lng: 73.8567, label: 'Pune site', source: 'gps' });
    expect(res.status).toBe(200);
    expect(res.body.current).toMatchObject({ lat: 18.5204, lng: 73.8567, label: 'Pune site', visibility: 'approximate' });
    expect(res.body.home).toEqual(before.home);
    expect(res.body.location.locality).toBe('Pune');
    expect(new Date(res.body.location.updatedAt).getTime()).toBeGreaterThan(new Date(before.location.updatedAt).getTime());

    const history = (await ctx.http().get(`/api/v1/users/me/listings/${id}/location-history`).set(auth(owner.token))).body;
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ label: 'Pune site', source: 'gps', lat: 18.5204, lng: 73.8567 });
  });

  it('the general edit endpoint cannot change the current location', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    await ctx.http().patch(`/api/v1/equipment/${id}`).set(auth(owner.token)).send({ current: at(10, 10), home: { lat: 18.0, lng: 76.0, label: 'New home' } });
    const after = (await ctx.http().get(`/api/v1/users/me/listings/${id}`).set(auth(owner.token))).body;
    expect(after.current).toMatchObject({ lat: 18.98317, lng: 76.94152 });
    expect(after.home).toMatchObject({ lat: 18, lng: 76, label: 'New home' });
    expect(await ctx.prisma.locationHistory.count({ where: { listingId: id } })).toBe(1);
  });

  it.each([
    [{ lat: 91, lng: 0 }], [{ lat: 0, lng: -181 }], [{ lat: 'abc', lng: 1 }], [{ lat: null, lng: null }], [{ lng: 73 }],
  ])('rejects invalid coordinates %o', async (coords) => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    const res = await ctx.http().patch(`/api/v1/equipment/${id}/location`).set(auth(owner.token)).send({ ...coords, label: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('nearby search', () => {
  it('filters by radius and sorts by distance from the current location', async () => {
    const owner = await register(ctx);
    // Distances from Palam (18.9667, 76.95): ~2 km, ~17 km, ~60 km. Pune is ~370 km away.
    const near = await listingAt(owner, 18.98, 76.96);
    const mid = await listingAt(owner, 19.12, 76.95);
    const far = await listingAt(owner, 19.5, 76.95);
    await listingAt(owner, 18.52, 73.86);

    const search = (radiusKm: number) => ctx.http().get('/api/v1/equipment/nearby').query({ lat: 18.9667, lng: 76.95, radiusKm });
    expect((await search(5)).body.items.map((i: { id: string }) => i.id)).toEqual([near.id]);
    expect((await search(25)).body.items.map((i: { id: string }) => i.id)).toEqual([near.id, mid.id]);
    const wide = (await search(100)).body;
    expect(wide.items.map((i: { id: string }) => i.id)).toEqual([near.id, mid.id, far.id]);
    const d = wide.items.map((i: { distanceKm: number }) => i.distanceKm);
    expect(d[0]).toBeLessThan(d[1]);
    expect(d[1]).toBeLessThan(d[2]);
    expect(d[2]).toBeGreaterThan(55);
    expect(d[2]).toBeLessThan(65);
  });

  it('uses the current location, not home', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner, { home: { lat: 18.52, lng: 73.86, label: 'Home in Pune' }, current: at(17.385, 78.4867) });
    const nearHome = await ctx.http().get('/api/v1/equipment/nearby').query({ lat: 18.52, lng: 73.86, radiusKm: 25 });
    const nearCurrent = await ctx.http().get('/api/v1/equipment/nearby').query({ lat: 17.385, lng: 78.4867, radiusKm: 25 });
    expect(nearHome.body.total).toBe(0);
    expect(nearCurrent.body.items[0].id).toBe(id);
  });

  it('works anywhere: no default location, searches by place slug, district and state', async () => {
    const owner = await register(ctx);
    const pune = await listingAt(owner, 18.53, 73.85);
    const nashik = await listingAt(owner, 20.0, 73.79);
    const hyd = await listingAt(owner, 17.39, 78.49);
    expect((await ctx.http().get('/api/v1/equipment')).body.total).toBe(3);
    expect((await ctx.http().get('/api/v1/equipment').query({ place: 'pune' })).body.items.map((i: { id: string }) => i.id)).toEqual([pune.id]);
    expect((await ctx.http().get('/api/v1/equipment').query({ place: 'hyderabad' })).body.items.map((i: { id: string }) => i.id)).toEqual([hyd.id]);
    const state = await ctx.http().get('/api/v1/equipment').query({ place: 'maharashtra' });
    expect(state.body.items.map((i: { id: string }) => i.id).sort()).toEqual([pune.id, nashik.id].sort());
    expect((await ctx.http().get('/api/v1/equipment').query({ place: 'nowhere-at-all' })).body.code).toBe('PLACE_NOT_FOUND');
  });

  it('filters by category, operation, price and operator, and sorts by price', async () => {
    const owner = await register(ctx);
    const a = await listingAt(owner, 18.53, 73.85, { price: 500 });
    const b = await listingAt(owner, 18.54, 73.86, { price: 1200, operatorTerm: 'equipment_only' });
    const q = (query: Record<string, unknown>) => ctx.http().get('/api/v1/equipment').query(query).then((r) => r.body.items.map((i: { id: string }) => i.id));
    expect(await q({ sort: 'price_asc' })).toEqual([a.id, b.id]);
    expect(await q({ sort: 'price_desc' })).toEqual([b.id, a.id]);
    expect(await q({ priceMax: 800 })).toEqual([a.id]);
    expect(await q({ operatorTerm: 'equipment_only' })).toEqual([b.id]);
    expect(await q({ category: 'tractors', operation: 'rotavating' })).toHaveLength(2);
    expect(await q({ operation: 'harvesting' })).toHaveLength(0);
    expect(await q({ q: 'mahindra' })).toHaveLength(2);
    expect(await q({ q: 'रोटाव्हेटर' })).toHaveLength(2);
  });

  it('rejects an out-of-range radius', async () => {
    const res = await ctx.http().get('/api/v1/equipment/nearby').query({ lat: 18, lng: 76, radiusKm: 5000 });
    expect(res.status).toBe(400);
    expect((await ctx.http().get('/api/v1/equipment/nearby').query({ lat: 18 })).status).toBe(400);
  });
});

describe('privacy', () => {
  it('public responses never contain exact coordinates, labels, owner identity or phone number', async () => {
    const owner = await register(ctx, { fullName: 'Ramesh Jadhav' });
    const { id } = await createListing(ctx, owner);
    for (const body of [
      (await ctx.http().get(`/api/v1/equipment/${id}`)).body,
      (await ctx.http().get('/api/v1/equipment').query({ lat: 18.97, lng: 76.95, radiusKm: 10 })).body,
    ]) {
      const text = JSON.stringify(body);
      for (const secret of ['18.98317', '76.94152', '18.97123', '76.95871', 'Shinde farm', 'Hanuman', 'Ramesh', 'Jadhav', owner.mobile, owner.userId])
        expect(text).not.toContain(secret);
    }
    const detail = (await ctx.http().get(`/api/v1/equipment/${id}`)).body;
    expect(detail.location.point).toEqual({ lat: 18.98, lng: 76.94 });
    expect(detail.location.locality).toBe('Palam');
    expect(detail.homeArea).toBeNull();
  });

  it('radius probing cannot locate the machine more precisely than the public grid', async () => {
    const owner = await register(ctx);
    await listingAt(owner, 18.98317, 76.94152);
    // Centred on the exact private point with the smallest radius: matches only via the snapped point.
    const exact = await ctx.http().get('/api/v1/equipment/nearby').query({ lat: 18.98317, lng: 76.94152, radiusKm: 1 });
    expect(exact.body.items[0].distanceKm).toBeCloseTo(0.4, 0);
  });

  it('locality-only listings publish no coordinates', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner, { current: { ...at(18.98317, 76.94152), visibility: 'locality_only' } });
    const detail = (await ctx.http().get(`/api/v1/equipment/${id}`)).body;
    expect(detail.location.point).toBeNull();
    expect(detail.location.locality).toBe('Palam');
  });

  it('home area is shown only when the owner chooses locality visibility', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner, { home: { lat: 18.52, lng: 73.86, label: 'My house', visibility: 'locality_only' } });
    const detail = (await ctx.http().get(`/api/v1/equipment/${id}`)).body;
    expect(detail.homeArea).toMatchObject({ locality: 'Pune', district: 'Pune', state: 'Maharashtra' });
    expect(JSON.stringify(detail)).not.toContain('My house');
  });

  it('suspended owners disappear from public results', async () => {
    const owner = await register(ctx);
    const { id } = await createListing(ctx, owner);
    await ctx.prisma.user.update({ where: { id: owner.userId }, data: { status: 'suspended' } });
    expect((await ctx.http().get('/api/v1/equipment')).body.total).toBe(0);
    expect((await ctx.http().get(`/api/v1/equipment/${id}`)).status).toBe(404);
  });
});
