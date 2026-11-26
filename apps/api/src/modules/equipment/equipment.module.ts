import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module.js';
import { EngagementService } from './engagement.service.js';
import { EquipmentController, MyEquipmentController } from './equipment.controller.js';
import { EquipmentService } from './equipment.service.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [LocationsModule],
  controllers: [MyEquipmentController, EquipmentController],
  providers: [EquipmentService, SearchService, EngagementService],
  exports: [SearchService],
})
export class EquipmentModule {}
