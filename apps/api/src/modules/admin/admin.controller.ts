import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminAuditQuerySchema, adminListingStatusSchema, adminListingsQuerySchema, adminReportUpdateSchema, adminReportsQuerySchema,
  adminUserStatusSchema, adminUsersQuerySchema, createCategorySchema, createEquipmentTypeSchema, createOperationSchema,
  updateCategorySchema, updateEquipmentTypeSchema, updateOperationSchema, type z,
} from '@yantramitra/shared-validation';
import { CurrentUser, type AuthedRequest, type AuthUser } from '../../common/auth.decorators.js';
import { ApiZod, uuidParam, zod } from '../../common/zod.js';
import { AdminGuard } from '../auth/auth.guard.js';
import { AdminService, type AdminActor } from './admin.service.js';

type Out<T extends z.ZodType> = z.output<T>;
const actor = (user: AuthUser, req: AuthedRequest): AdminActor => ({ adminId: user.adminId!, userId: user.id, ip: req.ip });

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform metrics' })
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('listings')
  @ApiZod({ query: adminListingsQuerySchema })
  listings(@Query(zod(adminListingsQuerySchema)) q: Out<typeof adminListingsQuerySchema>) {
    return this.admin.listings(q);
  }

  @Patch('listings/:id/status')
  @HttpCode(204)
  @ApiOperation({ summary: 'Suspend or restore a listing' })
  @ApiZod({ body: adminListingStatusSchema })
  listingStatus(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Param('id', uuidParam) id: string, @Body(zod(adminListingStatusSchema)) body: Out<typeof adminListingStatusSchema>) {
    return this.admin.setListingStatus(actor(u, req), id, body);
  }

  @Get('users')
  @ApiZod({ query: adminUsersQuerySchema })
  users(@Query(zod(adminUsersQuerySchema)) q: Out<typeof adminUsersQuerySchema>) {
    return this.admin.users(q);
  }

  @Patch('users/:id/status')
  @HttpCode(204)
  @ApiOperation({ summary: 'Suspend or reactivate a user (signs them out everywhere)' })
  @ApiZod({ body: adminUserStatusSchema })
  userStatus(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Param('id', uuidParam) id: string, @Body(zod(adminUserStatusSchema)) body: Out<typeof adminUserStatusSchema>) {
    return this.admin.setUserStatus(actor(u, req), id, body);
  }

  @Post('users/:id/password-reset')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Issue a one-time temporary password (shown once, expires in 24 h)' })
  resetPassword(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Param('id', uuidParam) id: string) {
    return this.admin.resetPassword(actor(u, req), id);
  }

  @Get('reports')
  @ApiZod({ query: adminReportsQuerySchema })
  reports(@Query(zod(adminReportsQuerySchema)) q: Out<typeof adminReportsQuerySchema>) {
    return this.admin.reports(q);
  }

  @Patch('reports/:id')
  @HttpCode(204)
  @ApiZod({ body: adminReportUpdateSchema })
  updateReport(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Param('id', uuidParam) id: string, @Body(zod(adminReportUpdateSchema)) body: Out<typeof adminReportUpdateSchema>) {
    return this.admin.updateReport(actor(u, req), id, body);
  }

  @Get('categories')
  categories() {
    return this.admin.categories();
  }

  @Post('categories')
  @ApiZod({ body: createCategorySchema })
  createCategory(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Body(zod(createCategorySchema)) body: Out<typeof createCategorySchema>) {
    return this.admin.createCategory(actor(u, req), body);
  }

  @Patch('categories/:id')
  @ApiZod({ body: updateCategorySchema })
  updateCategory(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Param('id', uuidParam) id: string, @Body(zod(updateCategorySchema)) body: Out<typeof updateCategorySchema>) {
    return this.admin.updateCategory(actor(u, req), id, body);
  }

  @Get('equipment-types')
  equipmentTypes() {
    return this.admin.equipmentTypes();
  }

  @Post('equipment-types')
  @ApiZod({ body: createEquipmentTypeSchema })
  createEquipmentType(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Body(zod(createEquipmentTypeSchema)) body: Out<typeof createEquipmentTypeSchema>) {
    return this.admin.createEquipmentType(actor(u, req), body);
  }

  @Patch('equipment-types/:id')
  @ApiZod({ body: updateEquipmentTypeSchema })
  updateEquipmentType(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Param('id', uuidParam) id: string, @Body(zod(updateEquipmentTypeSchema)) body: Out<typeof updateEquipmentTypeSchema>) {
    return this.admin.updateEquipmentType(actor(u, req), id, body);
  }

  @Get('operations')
  operations() {
    return this.admin.operations();
  }

  @Post('operations')
  @ApiZod({ body: createOperationSchema })
  createOperation(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Body(zod(createOperationSchema)) body: Out<typeof createOperationSchema>) {
    return this.admin.createOperation(actor(u, req), body);
  }

  @Patch('operations/:id')
  @ApiZod({ body: updateOperationSchema })
  updateOperation(@CurrentUser() u: AuthUser, @Req() req: AuthedRequest, @Param('id', uuidParam) id: string, @Body(zod(updateOperationSchema)) body: Out<typeof updateOperationSchema>) {
    return this.admin.updateOperation(actor(u, req), id, body);
  }

  @Get('audit-logs')
  @ApiZod({ query: adminAuditQuerySchema })
  auditLogs(@Query(zod(adminAuditQuerySchema)) q: Out<typeof adminAuditQuerySchema>) {
    return this.admin.auditLogs(q);
  }
}
