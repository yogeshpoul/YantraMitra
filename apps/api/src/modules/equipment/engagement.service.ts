import { Inject, Injectable } from '@nestjs/common';
import type { ClientContactEvent, ContactDto, ListingCardDto, Paginated, ReportReason } from '@yantramitra/shared-types';
import { AppError, notFound } from '../../common/app-error.js';
import type { AuthUser } from '../../common/auth.decorators.js';
import { paginated, skipTake, type PageRequest } from '../../common/pagination.js';
import { ENV, type Env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SearchService } from './search.service.js';

/** Favorites, contact reveal and reports. */
@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async addFavorite(user: AuthUser, listingId: string): Promise<void> {
    await this.search.detail(listingId); // must be publicly visible
    await this.prisma.userFavorite.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      create: { userId: user.id, listingId },
      update: {},
    });
  }

  async removeFavorite(user: AuthUser, listingId: string): Promise<void> {
    await this.prisma.userFavorite.deleteMany({ where: { userId: user.id, listingId } });
  }

  async favorites(user: AuthUser, page: PageRequest): Promise<Paginated<ListingCardDto>> {
    // Only listings still visible to the public.
    const where: Prisma.UserFavoriteWhereInput = {
      userId: user.id,
      listing: { status: { in: ['active', 'unavailable'] }, owner: { status: 'active' } },
    };
    const [rows, total] = await Promise.all([
      this.prisma.userFavorite.findMany({ where, orderBy: { createdAt: 'desc' }, select: { listingId: true }, ...skipTake(page) }),
      this.prisma.userFavorite.count({ where }),
    ]);
    return paginated(await this.search.cardsByIds(rows.map((r) => r.listingId)), total, page);
  }

  async favoriteIds(user: AuthUser): Promise<string[]> {
    const rows = await this.prisma.userFavorite.findMany({ where: { userId: user.id }, select: { listingId: true }, take: 1000 });
    return rows.map((r) => r.listingId);
  }

  /**
   * The only way to obtain an owner's number. Checks listing state, contact preference and the owner's
   * account, limits reveals per user per day, and records every reveal.
   */
  async contact(user: AuthUser, listingId: string): Promise<ContactDto> {
    const listing = await this.prisma.equipmentListing.findUnique({
      where: { id: listingId },
      select: { status: true, contactEnabled: true, allowWhatsapp: true, ownerId: true, owner: { select: { fullName: true, mobile: true, status: true } } },
    });
    if (!listing || listing.status === 'deleted' || listing.status === 'suspended') throw notFound('Listing');
    if (listing.status !== 'active') throw new AppError(409, 'LISTING_NOT_ACTIVE', 'This equipment is not available right now');
    if (!listing.contactEnabled) throw new AppError(403, 'CONTACT_DISABLED', 'The owner has turned off direct contact');
    if (listing.owner.status !== 'active') throw new AppError(409, 'OWNER_UNAVAILABLE', 'The owner cannot be contacted');

    if (listing.ownerId !== user.id) {
      const since = new Date(Date.now() - 86_400_000);
      const already = await this.prisma.contactEvent.count({ where: { userId: user.id, listingId, type: 'reveal', createdAt: { gte: since } } });
      if (!already) {
        const today = await this.prisma.contactEvent.count({ where: { userId: user.id, type: 'reveal', createdAt: { gte: since } } });
        if (today >= this.env.CONTACT_REVEALS_PER_DAY) throw new AppError(429, 'RATE_LIMITED', 'Daily contact limit reached');
      }
      await this.prisma.contactEvent.create({ data: { userId: user.id, listingId, type: 'reveal' } });
    }

    const phone = listing.owner.mobile;
    return {
      // First name only.
      ownerName: listing.owner.fullName.split(/\s+/)[0] ?? listing.owner.fullName,
      phone,
      whatsappUrl: listing.allowWhatsapp ? `https://wa.me/${phone.replace(/\D/g, '')}` : null,
    };
  }

  async contactEvent(user: AuthUser, listingId: string, type: ClientContactEvent): Promise<void> {
    const exists = await this.prisma.equipmentListing.count({ where: { id: listingId, status: { not: 'deleted' } } });
    if (!exists) throw notFound('Listing');
    await this.prisma.contactEvent.create({ data: { userId: user.id, listingId, type } });
  }

  async report(user: AuthUser, listingId: string, input: { reason: ReportReason; details: string | null }): Promise<{ id: string }> {
    const listing = await this.prisma.equipmentListing.findUnique({ where: { id: listingId }, select: { ownerId: true, status: true } });
    if (!listing || listing.status === 'deleted') throw notFound('Listing');
    if (listing.ownerId === user.id) throw new AppError(400, 'OWN_LISTING', 'You cannot report your own listing');
    try {
      const report = await this.prisma.listingReport.create({ data: { listingId, reporterId: user.id, reason: input.reason, details: input.details } });
      return { id: report.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new AppError(409, 'ALREADY_REPORTED', 'You have already reported this listing');
      throw e;
    }
  }
}
