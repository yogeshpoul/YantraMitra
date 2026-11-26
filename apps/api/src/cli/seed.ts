/**
 * Production-safe, idempotent catalogue seed. Inserts missing entries only; admin edits are preserved.
 *   pnpm --filter @yantramitra/api db:seed        (production image: node dist/cli/seed.js)
 */
import { seedCatalogue } from './catalogue-data.js';
import { run } from './db.js';

void run(async (db) => {
  await seedCatalogue(db);
  console.log(`Catalogue ready: ${await db.equipmentCategory.count()} categories, ${await db.equipmentType.count()} types, ${await db.operation.count()} operations`);
});
