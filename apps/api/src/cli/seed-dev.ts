/**
 * DEVELOPMENT ONLY. Creates sample owners and listings in several states so the marketplace can be tried
 * locally. Refuses to run when NODE_ENV=production. Sample accounts are
 * clearly fake (names start with "Demo") and share the password printed at the end.
 *
 *   pnpm --filter @yantramitra/api db:seed:dev
 */
import { hash } from '@node-rs/argon2';
import { Prisma } from '../generated/prisma/client.js';
import { seedCatalogue } from './catalogue-data.js';
import { run } from './db.js';

if (process.env.NODE_ENV === 'production') {
  console.error('seed-dev is for development only.');
  process.exit(1);
}

const PASSWORD = 'demo-pass-2025';
// [owner, type slug, title, pricing, price, operations, lat, lng]
const SAMPLES: [number, string, string, string, number | null, string[], number, number][] = [
  [0, 'tractor-with-rotavator', 'Mahindra 575 DI with rotavator', 'hourly', 900, ['rotavating', 'cultivation'], 18.9672, 76.9531],
  [0, 'combine-harvester', 'Combine harvester for soybean and wheat', 'per_acre', 2200, ['harvesting', 'threshing'], 18.9815, 76.9302],
  [1, 'agricultural-drone', 'Spraying drone, 10 litre tank', 'per_acre', 450, ['spraying', 'fertilizer-application'], 19.0105, 76.9902],
  [1, 'jcb', 'JCB 3DX for farm ponds and bunds', 'hourly', 1400, ['excavation', 'land-levelling'], 19.2608, 76.7748],
  [2, 'seed-drill', 'Nine-tyne seed drill', 'per_acre', 600, ['seed-sowing'], 18.5310, 73.8470],
  [2, 'tractor-trolley', 'Tractor with trolley for produce', 'per_day', 2500, ['transportation'], 18.6050, 73.9120],
  [3, 'power-sprayer', 'Power sprayer for grapes', 'per_day', 800, ['spraying'], 20.0050, 73.7900],
  [3, 'tractor', 'Swaraj 744 tractor', 'contact_for_price', null, ['ploughing', 'transportation'], 20.0420, 73.8350],
  [4, 'transplanter', 'Paddy transplanter, 4 row', 'per_acre', 1800, ['paddy-transplantation'], 17.4400, 78.4800],
  [4, 'water-pump', 'Diesel water pump 5 HP', 'per_day', 500, ['irrigation'], 12.9900, 77.5900],
];

void run(async (db) => {
  await seedCatalogue(db);
  const passwordHash = await hash(PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  const owners = [];
  for (let i = 0; i < 5; i++) {
    const mobile = `+9170000000${String(i + 10)}`;
    owners.push(await db.user.upsert({ where: { mobile }, create: { mobile, fullName: `Demo Owner ${i + 1}`, passwordHash, preferredLocale: 'mr' }, update: {} }));
  }
  const types = await db.equipmentType.findMany();
  const operations = await db.operation.findMany();
  let created = 0;
  for (const [owner, typeSlug, title, pricing, price, ops, lat, lng] of SAMPLES) {
    const type = types.find((t) => t.slug === typeSlug)!;
    if (await db.equipmentListing.count({ where: { title, ownerId: owners[owner]!.id } })) continue;
    const pt = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography`;
    const snapped = Prisma.sql`ST_SetSRID(ST_MakePoint(${Math.round(lng * 100) / 100}::float8, ${Math.round(lat * 100) / 100}::float8), 4326)::geography`;
    const [row] = await db.$queryRaw<{ id: string }[]>`
      WITH near AS (SELECT id, name, taluka, district, state, country_code FROM places WHERE kind IN ('village','town','city')
        AND ST_DWithin(point, ${pt}, 30000) ORDER BY point <-> ${pt} LIMIT 1)
      INSERT INTO equipment_listings (id, owner_id, category_id, equipment_type_id, title, pricing_type, price, is_negotiable, fuel_term, operator_term,
        transport_term, home_location, home_label, current_location, search_location, current_label, current_place_id, current_locality, current_taluka,
        current_district, current_state, current_country_code, status, created_at, updated_at)
      SELECT gen_random_uuid(), ${owners[owner]!.id}::uuid, ${type.categoryId}::uuid, ${type.id}::uuid, ${title}, ${pricing}::"PricingType", ${price}, true,
        'included', 'included', 'extra_cost', ${pt}, 'Demo home', ${pt}, ${snapped}, 'Demo field',
        near.id, near.name, near.taluka, near.district, near.state, near.country_code, 'active', now(), now()
      FROM (SELECT 1) one LEFT JOIN near ON true
      RETURNING id`;
    await db.listingOperation.createMany({ data: ops.map((slug) => ({ listingId: row!.id, operationId: operations.find((o) => o.slug === slug)!.id })) });
    await db.$executeRaw`INSERT INTO location_history (id, listing_id, location, label, source, changed_by_id) VALUES (gen_random_uuid(), ${row!.id}::uuid, ${pt}, 'Demo field', 'manual', ${owners[owner]!.id}::uuid)`;
    created++;
  }
  console.log(`DEV DATA: ${created} sample listings created. Sample owners +917000000010..14, password "${PASSWORD}".`);
});
