import { Injectable } from '@nestjs/common';
import type { LatLng, LocalityDto, PlaceDetailDto, PlaceDto, PlaceKind } from '@yantramitra/shared-types';
import { geography, likePattern } from '../../common/geo.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { LocationProvider } from './location-provider.js';

export interface PlaceRow {
  id: string;
  slug: string;
  name: string;
  kind: PlaceKind;
  taluka: string | null;
  district: string | null;
  state: string | null;
  countryCode: string;
  postalCode: string | null;
  lat: number;
  lng: number;
}

/** Listings within this distance of a place count towards its locality page. */
export const LOCALITY_RADIUS_KM = 25;
/** A locality page is indexed only with this many real listings, so search engines never see thin pages. */
export const MIN_LISTINGS_FOR_INDEXING = 3;

const COLUMNS = Prisma.sql`id, slug, name, kind, taluka, district, state, country_code AS "countryCode", postal_code AS "postalCode",
  ST_Y(point::geometry) AS lat, ST_X(point::geometry) AS lng`;

export function placeLabel(p: Pick<PlaceRow, 'name' | 'taluka' | 'district' | 'state' | 'postalCode' | 'kind'>): string {
  const parts = [p.kind === 'postal' ? `${p.postalCode} ${p.name}` : p.name, p.taluka, p.district, p.state].filter((v): v is string => Boolean(v));
  return parts.filter((v, i) => parts.indexOf(v) === i).join(', ');
}

export const toPlaceDto = (p: PlaceRow): PlaceDto => ({
  slug: p.slug, name: p.name, kind: p.kind, taluka: p.taluka, district: p.district, state: p.state,
  countryCode: p.countryCode.trim(), postalCode: p.postalCode, lat: p.lat, lng: p.lng, label: placeLabel(p),
});

/** Gazetteer queries. Also the free, offline `local` location provider. */
@Injectable()
export class PlacesService implements LocationProvider {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, limit: number): Promise<PlaceDto[]> {
    const q = query.trim().toLowerCase();
    if (/^\d{3,6}$/.test(q)) {
      const rows = await this.prisma.$queryRaw<PlaceRow[]>`
        SELECT ${COLUMNS} FROM places WHERE postal_code LIKE ${`${q}%`} ORDER BY (kind = 'postal') DESC, importance DESC LIMIT ${limit}`;
      return rows.map(toPlaceDto);
    }
    // "Palam, Parbhani" → every part must match; the first part is ranked against the place name.
    const terms = q.split(/[,\s]+/).filter((t) => t.length > 0).slice(0, 4);
    const first = (terms[0] ?? q).replace(/[\\%_]/g, '');
    const conditions = terms.map((t) => Prisma.sql`search_text LIKE ${likePattern(t)}`);
    // Slugs are ASCII, so "palam" also ranks "Pālam" as an exact match.
    const rows = await this.prisma.$queryRaw<PlaceRow[]>`
      SELECT ${COLUMNS} FROM places
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY (lower(name) = ${first} OR slug = ${first} OR slug LIKE ${`${first}-%`} AND slug !~ '-(taluka|district)$') DESC,
        (lower(name) LIKE ${`${first}%`}) DESC, importance DESC, length(name)
      LIMIT ${limit}`;
    return rows.map(toPlaceDto);
  }

  async reverse(point: LatLng): Promise<PlaceDto | null> {
    const row = await this.nearestSettlement(point);
    return row ? toPlaceDto(row) : null;
  }

  /** Nearest village, town or city: the public, non-identifying name for a position. */
  async nearestSettlement(point: LatLng, maxKm = 30): Promise<PlaceRow | null> {
    const at = geography(point);
    const rows = await this.prisma.$queryRaw<PlaceRow[]>`
      SELECT ${COLUMNS} FROM places
      WHERE kind IN ('village', 'town', 'city') AND ST_DWithin(point, ${at}, ${maxKm * 1000})
      ORDER BY point <-> ${at} LIMIT 1`;
    return rows[0] ?? null;
  }

  async bySlug(slug: string): Promise<PlaceRow | null> {
    const rows = await this.prisma.$queryRaw<PlaceRow[]>`SELECT ${COLUMNS} FROM places WHERE slug = ${slug.toLowerCase()} LIMIT 1`;
    return rows[0] ?? null;
  }

  async detail(slug: string): Promise<PlaceDetailDto | null> {
    const place = await this.bySlug(slug);
    if (!place) return null;
    const alternatives = await this.prisma.$queryRaw<PlaceRow[]>`
      SELECT ${COLUMNS} FROM places WHERE lower(name) = lower(${place.name}) AND id <> ${place.id}::uuid AND kind <> 'postal'
      ORDER BY importance DESC LIMIT 6`;
    return { ...toPlaceDto(place), alternatives: alternatives.map(toPlaceDto) };
  }

  /**
   * Localities that deserve their own page: towns, cities and administrative seats with enough real
   * listings nearby. Derived from live data, so it follows wherever listings appear.
   */
  async localities(limit = 500): Promise<LocalityDto[]> {
    return this.prisma.$queryRaw<LocalityDto[]>`
      SELECT p.slug, p.name, p.district, p.state, count(DISTINCT l.id)::int AS "listingCount"
      FROM equipment_listings l
      JOIN users u ON u.id = l.owner_id AND u.status = 'active'
      JOIN places p ON p.kind IN ('town', 'city') AND ST_DWithin(p.point, l.search_location, ${LOCALITY_RADIUS_KM * 1000})
      WHERE l.status = 'active'
      GROUP BY p.id
      HAVING count(DISTINCT l.id) >= ${MIN_LISTINGS_FOR_INDEXING}
      ORDER BY count(DISTINCT l.id) DESC, max(p.importance) DESC
      LIMIT ${limit}`;
  }
}
