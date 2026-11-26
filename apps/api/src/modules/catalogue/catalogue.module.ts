import { Controller, Get, Header, Module, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CategoryDto, EquipmentTypeDto, OperationDto } from '@yantramitra/shared-types';
import { Public } from '../../common/auth.decorators.js';
import { uuidParam } from '../../common/zod.js';
import { CatalogueService } from './catalogue.service.js';

@ApiTags('catalogue')
@Public()
@Controller()
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Active categories with their equipment types' })
  categories(): Promise<CategoryDto[]> {
    return this.catalogue.categories();
  }

  @Get('categories/:id/types')
  @ApiOperation({ summary: 'Active equipment types of a category' })
  types(@Param('id', uuidParam) id: string): Promise<EquipmentTypeDto[]> {
    return this.catalogue.types(id);
  }

  @Get('operations')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Active agricultural operations' })
  operations(): Promise<OperationDto[]> {
    return this.catalogue.operations();
  }
}

@Module({ controllers: [CatalogueController], providers: [CatalogueService], exports: [CatalogueService] })
export class CatalogueModule {}
