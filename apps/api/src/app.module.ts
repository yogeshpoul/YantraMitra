import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CoreModule } from './common/core.module.js';
import { AppThrottlerGuard } from './common/throttler.guard.js';
import { loadEnv } from './config/env.js';
import { AdminController } from './modules/admin/admin.controller.js';
import { AdminService } from './modules/admin/admin.service.js';
import { AuthGuard } from './modules/auth/auth.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogueModule } from './modules/catalogue/catalogue.module.js';
import { EquipmentModule } from './modules/equipment/equipment.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { LocationsModule } from './modules/locations/locations.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    CoreModule,
    // In-memory per instance. Login attempts are additionally limited in the database.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: () => loadEnv().RATE_LIMIT_PER_MINUTE }]),
    AuthModule,
    UsersModule,
    CatalogueModule,
    LocationsModule,
    EquipmentModule,
  ],
  controllers: [HealthController, AdminController],
  providers: [
    AdminService,
    // Order matters: rate limiting first, then authentication.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
