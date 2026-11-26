import { Injectable } from '@nestjs/common';
import {
  ADMIN_STATUS_TRANSITIONS, listingPath, type AdminAuditLogDto, type AdminCategoryDto, type AdminDashboardDto,
  type AdminEquipmentTypeDto, type AdminListingDto, type AdminOperationDto, type AdminReportDto, type AdminUserDto,
  type ListingStatus, type Paginated, type TempPasswordDto,
} from '@yantramitra/shared-types';
import type {
  adminAuditQuerySchema, adminListingStatusSchema, adminListingsQuerySchema, adminReportUpdateSchema, adminReportsQuerySchema,
  adminUserStatusSchema, adminUsersQuerySchema, createCategorySchema, createEquipmentTypeSchema, createOperationSchema,
  updateCategorySchema, updateEquipmentTypeSchema, updateOperationSchema, z,
} from '@yantramitra/shared-validation';
import { AppError, forbidden, notFound } from '../../common/app-error.js';
import { paginated, skipTake } from '../../common/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import { SessionService } from '../auth/session.service.js';
import { fromNames, toNames } from '../catalogue/catalogue.service.js';

export interface AdminActor {
  adminId: string;
  userId: string;
  ip: string | undefined;
}
type Out<T extends z.ZodType> = z.output<T>;

const TEMP_PASSWORD_HOURS = 24;
const REPORT_TRANSITIONS: Record<string, string[]> = { open: ['reviewing', 'resolved', 'dismissed'], reviewing: ['resolved', 'dismissed'] };
const iso = (d: Date | null) => d?.toISOString() ?? null;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  /** Written in the same transaction as the change it describes. */
  private audit(tx: Prisma.TransactionClient, actor: AdminActor, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
    return tx.adminAuditLog.create({
      data: {
        adminId: actor.adminId, action, entityType, entityId, ipAddress: actor.ip,
        before: before === null ? undefined : (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue),
        after: after === null ? undefined : (JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue),
      },
    });
  }

  async dashboard(): Promise<AdminDashboardDto> {
    const week = new Date(Date.now() - 7 * 86_400_000);
    const month = new Date(Date.now() - 30 * 86_400_000);
    const [users, usersWeek, listings, listingsWeek, reports, contactsWeek, contactsMonth, topDistricts] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: week } } }),
      this.prisma.equipmentListing.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.equipmentListing.count({ where: { createdAt: { gte: week } } }),
      this.prisma.listingReport.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.contactEvent.count({ where: { type: 'reveal', createdAt: { gte: week } } }),
      this.prisma.contactEvent.count({ where: { type: 'reveal', createdAt: { gte: month } } }),
      this.prisma.$queryRaw<{ district: string | null; state: string | null; count: number }[]>`
        SELECT current_district AS district, current_state AS state, count(*)::int AS count FROM equipment_listings
        WHERE status = 'active' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10`,
    ]);
    const userCount = (s: string) => users.find((u) => u.status === s)?._count._all ?? 0;
    const listingCount = (s: ListingStatus) => listings.find((l) => l.status === s)?._count._all ?? 0;
    const reportCount = (s: string) => reports.find((r) => r.status === s)?._count._all ?? 0;
    return {
      users: { total: users.reduce((a, u) => a + u._count._all, 0), active: userCount('active'), suspended: userCount('suspended'), last7Days: usersWeek },
      listings: {
        active: listingCount('active'), inactive: listingCount('inactive'), unavailable: listingCount('unavailable'),
        suspended: listingCount('suspended'), deleted: listingCount('deleted'), last7Days: listingsWeek,
      },
      reports: { open: reportCount('open'), reviewing: reportCount('reviewing') },
      contacts: { last7Days: contactsWeek, last30Days: contactsMonth },
      topDistricts,
    };
  }

  async listings(q: Out<typeof adminListingsQuerySchema>): Promise<Paginated<AdminListingDto>> {
    const where: Prisma.EquipmentListingWhereInput = {
      status: q.status,
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { owner: { mobile: { contains: q.q } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.equipmentListing.findMany({
        where, orderBy: { createdAt: 'desc' }, ...skipTake(q),
        include: {
          category: true, type: true, owner: true,
          _count: { select: { reports: { where: { status: { in: ['open', 'reviewing'] } } } } },
        },
      }),
      this.prisma.equipmentListing.count({ where }),
    ]);
    return paginated(rows.map((l) => ({
      id: l.id, path: listingPath(l.category.slug, l.type.slug, l.id), title: l.title, status: l.status, suspendedReason: l.suspendedReason,
      categoryNames: toNames(l.category),
      owner: { id: l.owner.id, fullName: l.owner.fullName, mobile: l.owner.mobile, status: l.owner.status },
      area: { locality: l.currentLocality, taluka: l.currentTaluka, district: l.currentDistrict, state: l.currentState, countryCode: l.currentCountryCode },
      openReports: l._count.reports, createdAt: l.createdAt.toISOString(),
    })), total, q);
  }

  async setListingStatus(actor: AdminActor, id: string, input: Out<typeof adminListingStatusSchema>): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const listing = await tx.equipmentListing.findUnique({ where: { id }, select: { status: true, suspendedReason: true } });
      if (!listing) throw notFound('Listing');
      if (!ADMIN_STATUS_TRANSITIONS[listing.status].includes(input.status))
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Cannot change a ${listing.status} listing to ${input.status}`);
      const suspendedReason = input.status === 'suspended' ? input.reason : null;
      const res = await tx.equipmentListing.updateMany({ where: { id, status: listing.status }, data: { status: input.status, suspendedReason } });
      if (res.count !== 1) throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'The listing changed meanwhile');
      await this.audit(tx, actor, input.status === 'suspended' ? 'listing.suspend' : 'listing.restore', 'listing', id, listing, { status: input.status, suspendedReason });
    });
  }

  async users(q: Out<typeof adminUsersQuerySchema>): Promise<Paginated<AdminUserDto>> {
    const where: Prisma.UserWhereInput = {
      status: q.status,
      ...(q.q ? { OR: [{ fullName: { contains: q.q, mode: 'insensitive' } }, { mobile: { contains: q.q.replace(/\s/g, '') } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where, orderBy: { createdAt: 'desc' }, ...skipTake(q),
        include: { admin: true, _count: { select: { listings: { where: { status: { not: 'deleted' } } } } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(rows.map((u) => ({
      id: u.id, fullName: u.fullName, mobile: u.mobile, status: u.status, isAdmin: u.admin?.isActive ?? false,
      mustChangePassword: u.mustChangePassword, listingCount: u._count.listings, lastLoginAt: iso(u.lastLoginAt), createdAt: u.createdAt.toISOString(),
    })), total, q);
  }

  private async targetUser(tx: Prisma.TransactionClient, actor: AdminActor, id: string) {
    const user = await tx.user.findUnique({ where: { id }, include: { admin: true } });
    if (!user || user.status === 'deleted') throw notFound('User');
    // Administrator accounts are managed with the CLI only.
    if (user.id === actor.userId || user.admin) throw forbidden('Administrator accounts cannot be changed here');
    return user;
  }

  async setUserStatus(actor: AdminActor, id: string, input: Out<typeof adminUserStatusSchema>): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await this.targetUser(tx, actor, id);
      await tx.user.update({ where: { id }, data: { status: input.status } });
      if (input.status === 'suspended') await this.sessions.revokeAll(id, 'suspended', tx);
      await this.audit(tx, actor, `user.${input.status === 'suspended' ? 'suspend' : 'reactivate'}`, 'user', id, { status: user.status }, { status: input.status, reason: input.reason });
    });
  }

  /**
   * Administrator-assisted recovery. Returns a one-time temporary password exactly once; it is never stored
   * in readable form, all sessions end, and the user must replace it at the next sign-in.
   */
  async resetPassword(actor: AdminActor, id: string): Promise<TempPasswordDto> {
    const temporaryPassword = this.passwords.generateTemporary();
    const passwordHash = await this.passwords.hash(temporaryPassword);
    const expiresAt = new Date(Date.now() + TEMP_PASSWORD_HOURS * 3_600_000);
    await this.prisma.$transaction(async (tx) => {
      await this.targetUser(tx, actor, id);
      await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true, tempPasswordExpiresAt: expiresAt, passwordChangedAt: new Date() } });
      await this.sessions.revokeAll(id, 'admin_password_reset', tx);
      await this.audit(tx, actor, 'user.password_reset', 'user', id, null, { expiresAt });
    });
    return { temporaryPassword, expiresAt: expiresAt.toISOString() };
  }

  async reports(q: Out<typeof adminReportsQuerySchema>): Promise<Paginated<AdminReportDto>> {
    const where: Prisma.ListingReportWhereInput = { status: q.status };
    const [rows, total] = await Promise.all([
      this.prisma.listingReport.findMany({
        where, orderBy: { createdAt: 'desc' }, ...skipTake(q),
        include: { listing: { include: { category: true, type: true } }, reporter: true },
      }),
      this.prisma.listingReport.count({ where }),
    ]);
    return paginated(rows.map((r) => ({
      id: r.id, reason: r.reason, details: r.details, status: r.status, resolutionNote: r.resolutionNote,
      listing: { id: r.listing.id, title: r.listing.title, status: r.listing.status, path: listingPath(r.listing.category.slug, r.listing.type.slug, r.listing.id) },
      reporter: { id: r.reporter.id, fullName: r.reporter.fullName },
      createdAt: r.createdAt.toISOString(), resolvedAt: iso(r.resolvedAt),
    })), total, q);
  }

  async updateReport(actor: AdminActor, id: string, input: Out<typeof adminReportUpdateSchema>): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const report = await tx.listingReport.findUnique({ where: { id } });
      if (!report) throw notFound('Report');
      if (!REPORT_TRANSITIONS[report.status]?.includes(input.status))
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Cannot change a ${report.status} report to ${input.status}`);
      const final = input.status !== 'reviewing';
      await tx.listingReport.update({
        where: { id },
        data: { status: input.status, resolutionNote: input.resolutionNote, resolvedById: final ? actor.adminId : null, resolvedAt: final ? new Date() : null },
      });
      await this.audit(tx, actor, `report.${input.status}`, 'report', id, { status: report.status }, input);
    });
  }

  // ── Catalogue ─────────────────────────────────────────────────────────
  async categories(): Promise<AdminCategoryDto[]> {
    const rows = await this.prisma.equipmentCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] });
    return rows.map((c) => ({ id: c.id, slug: c.slug, names: toNames(c), iconKey: c.iconKey, sortOrder: c.sortOrder, isActive: c.isActive }));
  }

  async equipmentTypes(): Promise<AdminEquipmentTypeDto[]> {
    const rows = await this.prisma.equipmentType.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] });
    return rows.map((t) => ({ id: t.id, slug: t.slug, names: toNames(t), iconKey: t.iconKey, categoryId: t.categoryId, sortOrder: t.sortOrder, isActive: t.isActive }));
  }

  async operations(): Promise<AdminOperationDto[]> {
    const rows = await this.prisma.operation.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] });
    return rows.map((o) => ({ id: o.id, slug: o.slug, names: toNames(o), sortOrder: o.sortOrder, isActive: o.isActive }));
  }

  createCategory(actor: AdminActor, input: Out<typeof createCategorySchema>) {
    const { names, ...rest } = input;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.equipmentCategory.create({ data: { ...rest, ...fromNames(names) } });
      await this.audit(tx, actor, 'category.create', 'category', row.id, null, input);
      return { id: row.id };
    });
  }

  updateCategory(actor: AdminActor, id: string, input: Out<typeof updateCategorySchema>) {
    const { names, ...rest } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.equipmentCategory.findUnique({ where: { id } });
      if (!before) throw notFound('Category');
      await tx.equipmentCategory.update({ where: { id }, data: { ...rest, ...(names ? fromNames(names) : {}) } });
      await this.audit(tx, actor, 'category.update', 'category', id, before, input);
      return { id };
    });
  }

  createEquipmentType(actor: AdminActor, input: Out<typeof createEquipmentTypeSchema>) {
    const { names, ...rest } = input;
    return this.prisma.$transaction(async (tx) => {
      if (!(await tx.equipmentCategory.count({ where: { id: input.categoryId } }))) throw new AppError(400, 'INVALID_CATALOGUE_REFERENCE', 'Unknown category', { categoryId: 'invalid' });
      const row = await tx.equipmentType.create({ data: { ...rest, ...fromNames(names) } });
      await this.audit(tx, actor, 'equipment_type.create', 'equipment_type', row.id, null, input);
      return { id: row.id };
    });
  }

  updateEquipmentType(actor: AdminActor, id: string, input: Out<typeof updateEquipmentTypeSchema>) {
    const { names, ...rest } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.equipmentType.findUnique({ where: { id } });
      if (!before) throw notFound('Equipment type');
      await tx.equipmentType.update({ where: { id }, data: { ...rest, ...(names ? fromNames(names) : {}) } });
      await this.audit(tx, actor, 'equipment_type.update', 'equipment_type', id, before, input);
      return { id };
    });
  }

  createOperation(actor: AdminActor, input: Out<typeof createOperationSchema>) {
    const { names, ...rest } = input;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.operation.create({ data: { ...rest, ...fromNames(names) } });
      await this.audit(tx, actor, 'operation.create', 'operation', row.id, null, input);
      return { id: row.id };
    });
  }

  updateOperation(actor: AdminActor, id: string, input: Out<typeof updateOperationSchema>) {
    const { names, ...rest } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.operation.findUnique({ where: { id } });
      if (!before) throw notFound('Operation');
      await tx.operation.update({ where: { id }, data: { ...rest, ...(names ? fromNames(names) : {}) } });
      await this.audit(tx, actor, 'operation.update', 'operation', id, before, input);
      return { id };
    });
  }

  async auditLogs(q: Out<typeof adminAuditQuerySchema>): Promise<Paginated<AdminAuditLogDto>> {
    const where: Prisma.AdminAuditLogWhereInput = { entityId: q.entityId, action: q.action ? { startsWith: q.action } : undefined };
    const [rows, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q), include: { admin: { include: { user: true } } } }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return paginated(rows.map((r) => ({
      id: r.id, adminName: r.admin.user.fullName, action: r.action, entityType: r.entityType, entityId: r.entityId,
      before: r.before, after: r.after, createdAt: r.createdAt.toISOString(),
    })), total, q);
  }
}
