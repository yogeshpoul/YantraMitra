import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MeDto } from '@yantramitra/shared-types';
import { updateProfileSchema, type z } from '@yantramitra/shared-validation';
import { CurrentUser, type AuthUser } from '../../common/auth.decorators.js';
import { ApiZod, zod } from '../../common/zod.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Own profile' })
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.users.me(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update own name or language' })
  @ApiZod({ body: updateProfileSchema })
  update(@CurrentUser() user: AuthUser, @Body(zod(updateProfileSchema)) body: z.output<typeof updateProfileSchema>): Promise<MeDto> {
    return this.users.update(user.id, body);
  }
}
