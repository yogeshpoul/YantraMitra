import { Inject, Injectable } from '@nestjs/common';
import type { LatLng, ListingCardDto, ListingDetailDto, OperationDto, Paginated } from '@yantramitra/shared-types';
import type { SearchData } from '@yantramitra/shared-validation';
import { AppError, notFound } from '../../common/app-error.js';
import { geography, likePattern } from '../../common/geo.js';
import { paginated } from '../../common/pagination.js';
import { ENV, type Env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toNames } from '../catalogue/catalogue.service.js';
import { PlacesService } from '../locations/places.service.js';
import { CARD_COLUMNS, DETAIL_COLUMNS, LISTING_FROM, toCard, toDetail, type CardRow, type DetailRow } from './listing.sql.js';

/** Statuses a visitor may open directly. Search results show `active` only. */
export const PUBLIC_DETAIL_STATUSES = Prisma.sql`l.status IN ('active', 'unavailable') AND u.status = 'active'`;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly places: PlacesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Public search. No location is assumed: without a place or coordinates every listing qualifies.
   * Distance and radius always use `search_location`, the public projection of the current location.
   */
  async search(query: SearchData): Promise<Paginated<ListingCardDto>> {
    const where: Prisma.Sql[] = [Prisma.sql`l.status = 'active'`, Prisma.sql`u.status = 'active'`];
    let point: LatLng | null = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : null;

    if (query.place && !point) {
      const place = await this.places.bySlug(query.place);
      if (!place) throw new AppError(404, 'PLACE_NOT_FOUND', 'Place not found');
      if (place.kind === 'state' && !query.radiusKm) {
        where.push(Prisma.sql`l.current_state = ${place.state} AND l.current_country_code = ${place.countryCode}`);
      } else if (place.kind === 'district' && !query.radiusKm) {
        where.push(Prisma.sql`l.current_district = ${place.district} AND l.current_state = ${place.state}`);
      } else {
        point = { lat: place.lat, lng: place.lng };
      }
    }

    let distance = Prisma.sql`NULL::float8`;
    if (point) {
      const at = geography(point);
      const radiusM = (query.radiusKm ?? this.env.DEFAULT_SEARCH_RADIUS_KM) * 1000;
      where.push(Prisma.sql`ST_DWithin(l.search_location, ${at}, ${radiusM})`);
      distance = Prisma.sql`ST_Distance(l.search_location, ${at})`;
    }

    if (query.q) {
      const p = likePattern(query.q);
      where.push(Prisma.sql`(l.title ILIKE ${p} OR l.manufacturer ILIKE ${p} OR l.model ILIKE ${p}
        OR t.name_en ILIKE ${p} OR t.name_mr ILIKE ${p} OR t.name_hi ILIKE ${p}
        OR c.name_en ILIKE ${p} OR c.name_mr ILIKE ${p} OR c.name_hi ILIKE ${p})`);
    }
    if (query.category) where.push(Prisma.sql`c.slug = ${query.category}`);
    if (query.type) where.push(Prisma.sql`t.slug = ${query.type}`);
    if (query.operation)
      where.push(Prisma.sql`EXISTS (SELECT 1 FROM listing_operations lo JOIN operations o ON o.id = lo.operation_id
        WHERE lo.listing_id = l.id AND o.slug = ${query.operation})`);
    if (query.pricingType) where.push(Prisma.sql`l.pricing_type = ${query.pricingType}::"PricingType"`);
    if (query.operatorTerm) where.push(Prisma.sql`l.operator_term = ${query.operatorTerm}::"OperatorTerm"`);
    if (query.priceMin !== undefined) where.push(Prisma.sql`l.price >= ${query.priceMin}`);
    if (query.priceMax !== undefined) where.push(Prisma.sql`l.price <= ${query.priceMax}`);

    const sort = query.sort ?? (point ? 'nearest' : 'recent');
    const orderBy = {
      nearest: point ? Prisma.sql`distance_m ASC, l.updated_at DESC` : Prisma.sql`l.updated_at DESC`,
      recent: Prisma.sql`l.updated_at DESC`,
      price_asc: Prisma.sql`l.price ASC NULLS LAST, l.updated_at DESC`,
      price_desc: Prisma.sql`l.price DESC NULLS LAST, l.updated_at DESC`,
    }[sort];

    const whereSql = Prisma.join(where, ' AND ');
    const offset = (query.page - 1) * query.pageSize;
    const [rows, count] = await Promise.all([
      this.prisma.$queryRaw<(CardRow & { distance_m: number | null })[]>`
        SELECT ${CARD_COLUMNS}, ${distance} AS distance_m ${LISTING_FROM}
        WHERE ${whereSql} ORDER BY ${orderBy}, l.id LIMIT ${query.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${LISTING_FROM} WHERE ${whereSql}`,
    ]);
    return paginated(rows.map((r) => toCard({ ...r, distanceM: r.distance_m })), count[0]?.n ?? 0, query);
  }

  async detail(id: string): Promise<ListingDetailDto> {
    const rows = await this.prisma.$queryRaw<DetailRow[]>`
      SELECT ${DETAIL_COLUMNS} ${LISTING_FROM} WHERE l.id = ${id}::uuid AND ${PUBLIC_DETAIL_STATUSES}`;
    const row = rows[0];
    if (!row) throw notFound('Listing');
    return toDetail(row, await this.operationsOf(id));
  }

  async cardsByIds(ids: string[]): Promise<ListingCardDto[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.$queryRaw<CardRow[]>`
      SELECT ${CARD_COLUMNS} ${LISTING_FROM} WHERE l.id IN (${Prisma.join(ids.map((i) => Prisma.sql`${i}::uuid`))}) AND ${PUBLIC_DETAIL_STATUSES}`;
    const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
    return ids.map((i) => byId.get(i)).filter((c): c is ListingCardDto => Boolean(c));
  }

  async operationsOf(listingId: string): Promise<OperationDto[]> {
    const rows = await this.prisma.listingOperation.findMany({
      where: { listingId },
      include: { operation: true },
      orderBy: { operation: { sortOrder: 'asc' } },
    });
    return rows.map(({ operation: o }) => ({ id: o.id, slug: o.slug, names: toNames(o) }));
  }
}
