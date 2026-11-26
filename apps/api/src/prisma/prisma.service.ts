import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV, type Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    // maxWait covers opening a new connection on a cold serverless instance; the default 2 s is too tight for hosted databases.
    super({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX }),
      transactionOptions: { maxWait: 10_000, timeout: 15_000 },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
