import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { seedCatalogue } from '../src/cli/catalogue-data.js';
import { loadEnv } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

export async function createApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, loadEnv());
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma, http: () => request(app.getHttpServer()) };
}

/** Clears every table, then re-seeds the catalogue and a few gazetteer places, so each test starts identically. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE admin_audit_logs DISABLE TRIGGER admin_audit_logs_append_only`);
  await prisma.$executeRawUnsafe(`TRUNCATE admin_audit_logs, contact_events, listing_reports, user_favorites, location_history,
    listing_operations, equipment_images, equipment_listings, admin_users, sessions, login_throttles, users, places,
    equipment_types, equipment_categories, operations CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE admin_audit_logs ENABLE TRIGGER admin_audit_logs_append_only`);
  await seedCatalogue(prisma);
  // Fixture gazetteer across India: no single region is special.
  const places: [string, string, string, string | null, string | null, string, number, number][] = [
    ['palam', 'Palam', 'town', 'Palam', 'Parbhani', 'Maharashtra', 18.9667, 76.9500],
    ['parbhani-district', 'Parbhani', 'district', null, 'Parbhani', 'Maharashtra', 19.27, 76.77],
    ['pune', 'Pune', 'city', 'Haveli', 'Pune', 'Maharashtra', 18.5196, 73.8553],
    ['nashik', 'Nashik', 'city', 'Nashik', 'Nashik', 'Maharashtra', 19.9975, 73.7898],
    ['hyderabad', 'Hyderabad', 'city', null, 'Hyderabad', 'Telangana', 17.3850, 78.4867],
    ['bengaluru', 'Bengaluru', 'city', null, 'Bengaluru Urban', 'Karnataka', 12.9716, 77.5946],
    ['maharashtra', 'Maharashtra', 'state', null, null, 'Maharashtra', 19.5, 75.5],
  ];
  for (const [slug, name, kind, taluka, district, state, lat, lng] of places) {
    await prisma.$executeRaw`
      INSERT INTO places (id, source, source_id, slug, name, kind, taluka, district, state, country_code, point, importance, search_text)
      VALUES (gen_random_uuid(), 'test', ${slug}, ${slug}, ${name}, ${kind}::"PlaceKind", ${taluka}, ${district}, ${state}, 'IN',
        ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography, 1, ${`${name} ${district ?? ''} ${state}`.toLowerCase()})`;
  }
}

let counter = 0;
export function uniqueMobile(): string {
  counter += 1;
  return `+9198${String(Date.now() % 1_000_000).padStart(6, '0')}${String(counter % 100).padStart(2, '0')}`;
}

export interface Session {
  token: string;
  refreshToken: string;
  userId: string;
  mobile: string;
}

export async function register(ctx: TestContext, overrides: Record<string, unknown> = {}): Promise<Session> {
  const mobile = (overrides.mobile as string | undefined) ?? uniqueMobile();
  const res = await ctx.http().post('/api/v1/auth/register').set('X-Client-Type', 'native').send({
    fullName: 'Ramesh Jadhav', mobile, password: 'shetkari-42', confirmPassword: 'shetkari-42', preferredLocale: 'mr', ...overrides,
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken, refreshToken: res.body.refreshToken, userId: res.body.user.id, mobile };
}

export async function catalogue(ctx: TestContext) {
  const categories = (await ctx.http().get('/api/v1/categories')).body as { id: string; slug: string; types: { id: string; slug: string }[] }[];
  const operations = (await ctx.http().get('/api/v1/operations')).body as { id: string; slug: string }[];
  const tractors = categories.find((c) => c.slug === 'tractors')!;
  return { categories, operations, tractors, tractorType: tractors.types.find((t) => t.slug === 'tractor-with-rotavator')! };
}

export async function listingInput(ctx: TestContext, overrides: Record<string, unknown> = {}) {
  const { tractors, tractorType, operations } = await catalogue(ctx);
  return {
    categoryId: tractors.id, equipmentTypeId: tractorType.id, title: 'Mahindra tractor with rotavator', manufacturer: 'Mahindra',
    model: '575 DI', manufacturingYear: 2019, description: 'Well maintained.',
    operationIds: [operations.find((o) => o.slug === 'rotavating')!.id],
    pricingType: 'hourly', price: 900, isNegotiable: true, minHours: 2,
    fuelTerm: 'included', operatorTerm: 'included', transportTerm: 'extra_cost',
    home: { lat: 18.97123, lng: 76.95871, label: 'Behind the Hanuman temple, my house', visibility: 'hidden', source: 'gps' },
    current: { lat: 18.98317, lng: 76.94152, label: 'Shinde farm, survey 42', visibility: 'approximate', source: 'map' },
    contactEnabled: true, allowWhatsapp: true,
    ...overrides,
  };
}

export async function createListing(ctx: TestContext, s: Session, overrides: Record<string, unknown> = {}) {
  const res = await ctx.http().post('/api/v1/equipment').set('Authorization', `Bearer ${s.token}`).send(await listingInput(ctx, overrides));
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; path: string };
}

export async function makeAdmin(ctx: TestContext): Promise<Session> {
  const s = await register(ctx, { fullName: 'Admin Person' });
  await ctx.prisma.adminUser.create({ data: { userId: s.userId } });
  return s;
}
