import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function connect(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  // Generous transaction limits: a fresh TLS connection to a distant hosted database can take seconds.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), transactionOptions: { maxWait: 15_000, timeout: 30_000 } });
}

export async function run(main: (db: PrismaClient) => Promise<void>): Promise<void> {
  const db = connect();
  try {
    await main(db);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
