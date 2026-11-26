import { Controller, Get, HttpException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth.decorators.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: database and PostGIS reachable' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT postgis_lib_version()`;
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new HttpException({ status: 'error', database: 'unavailable' }, 503);
    }
  }
}
