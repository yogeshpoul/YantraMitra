import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Empty during `prisma generate` in CI and image builds, where no database is needed.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
