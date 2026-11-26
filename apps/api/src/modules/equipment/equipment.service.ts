import { Inject, Injectable } from '@nestjs/common';
import {
  OWNER_STATUS_TRANSITIONS, type CurrentVisibility, type LatLng, type ListingStatus, type LocationHistoryDto,
  type LocationSource, type OwnerListingDto, type Paginated, type PublicArea,
} from '@yantramitra/shared-types';
import type { CreateListingData, UpdateListingData, updateLocationSchema, z } from '@yantramitra/shared-validation';
import { AppError, forbidden, invalidField, notFound } from '../../common/app-error.js';
import type { AuthUser } from '../../common/auth.decorators.js';
import { geography, publicPoint } from '../../common/geo.js';
import { paginated, type PageRequest } from '../../common/pagination.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LOCATION_PROVIDER, type LocationProvider } from '../locations/location-provider.js';
import { PlacesService } from '../locations/places.service.js';
import { LISTING_FROM, OWNER_COLUMNS, toOwner, type OwnerRow } from './listing.sql.js';
import { SearchService } from './search.service.js';

interface Area extends PublicArea {
  placeId: string | null;
}

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly places: PlacesService,
    private readonly search: SearchService,
    @Inject(LOCATION_PROVIDER) private readonly provider: LocationProvider,
  ) {}

  async create(user: AuthUser, input: CreateListingData): Promise<OwnerListingDto> {
    await this.assertCatalogue(input.categoryId, input.equipmentTypeId, input.operationIds);
    const [currentArea, homeArea] = await Promise.all([this.areaFor(input.current), this.areaFor(input.home)]);
    const search = publicPoint(input.current, input.current.visibility);

    const id = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO equipment_listings (
          id, owner_id, category_id, equipment_type_id, title, manufacturer, model, manufacturing_year, description,
          pricing_type, price, is_negotiable, min_hours, min_acres, fuel_term, operator_term, transport_term, additional_conditions,
          home_location, home_label, home_visibility, home_place_id,
          current_location, search_location, current_label, current_visibility, current_place_id,
          current_locality, current_taluka, current_district, current_state, current_country_code, current_location_updated_at,
          contact_enabled, allow_whatsapp, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${user.id}::uuid, ${input.categoryId}::uuid, ${input.equipmentTypeId}::uuid, ${input.title},
          ${input.manufacturer}, ${input.model}, ${input.manufacturingYear}, ${input.description},
          ${input.pricingType}::"PricingType", ${input.price}, ${input.isNegotiable}, ${input.minHours}, ${input.minAcres},
          ${input.fuelTerm}::"FuelTerm", ${input.operatorTerm}::"OperatorTerm", ${input.transportTerm}::"TransportTerm",
          ${input.additionalConditions},
          ${geography(input.home)}, ${input.home.label}, ${input.home.visibility}::"LocationVisibility", ${homeArea.placeId}::uuid,
          ${geography(input.current)}, ${geography(search)}, ${input.current.label}, ${input.current.visibility}::"LocationVisibility",
          ${currentArea.placeId}::uuid, ${currentArea.locality}, ${currentArea.taluka}, ${currentArea.district}, ${currentArea.state},
          ${currentArea.countryCode}, now(),
          ${input.contactEnabled}, ${input.allowWhatsapp}, 'active', now(), now()
        ) RETURNING id`;
      const listingId = inserted[0]!.id;
      await tx.listingOperation.createMany({ data: input.operationIds.map((operationId) => ({ listingId, operationId })) });
      await this.recordLocation(tx, listingId, user.id, input.current, input.current.label, input.current.source);
      return listingId;
    });
    return this.ownerView(id, user.id);
  }

  async update(user: AuthUser, id: string, input: UpdateListingData): Promise<OwnerListingDto> {
    const listing = await this.owned(user, id);
    if (input.categoryId && input.equipmentTypeId) await this.assertCatalogue(input.categoryId, input.equipmentTypeId, []);
    if (input.operationIds) await this.assertCatalogue(null, null, input.operationIds);
    const homeArea = input.home ? await this.areaFor(input.home) : null;

    const pricingType = input.pricingType;
    const price = pricingType === 'contact_for_price' ? null : input.price;
    const data: Prisma.EquipmentListingUncheckedUpdateInput = {
      categoryId: input.categoryId,
      equipmentTypeId: input.equipmentTypeId,
      title: input.title,
      manufacturer: input.manufacturer,
      model: input.model,
      manufacturingYear: input.manufacturingYear,
      description: input.description,
      pricingType,
      price: pricingType ? price : undefined,
      isNegotiable: input.isNegotiable,
      minHours: input.minHours,
      minAcres: input.minAcres,
      fuelTerm: input.fuelTerm,
      operatorTerm: input.operatorTerm,
      transportTerm: input.transportTerm,
      additionalConditions: input.additionalConditions,
      contactEnabled: input.contactEnabled,
      allowWhatsapp: input.allowWhatsapp,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.equipmentListing.update({ where: { id: listing.id }, data });
      if (input.operationIds) {
        await tx.listingOperation.deleteMany({ where: { listingId: id } });
        await tx.listingOperation.createMany({ data: input.operationIds.map((operationId) => ({ listingId: id, operationId })) });
      }
      // Home and current are independent: editing home never moves the current location.
      if (input.home && homeArea)
        await tx.$executeRaw`UPDATE equipment_listings SET home_location = ${geography(input.home)}, home_label = ${input.home.label},
          home_visibility = ${input.home.visibility}::"LocationVisibility", home_place_id = ${homeArea.placeId}::uuid WHERE id = ${id}::uuid`;
    });
    return this.ownerView(id, user.id);
  }

  /** Moves the current location only. Home is untouched and the move is appended to the history. */
  async updateLocation(user: AuthUser, id: string, input: z.output<typeof updateLocationSchema>): Promise<OwnerListingDto> {
    const listing = await this.owned(user, id);
    const visibility = input.visibility ?? (listing.currentVisibility as CurrentVisibility);
    const area = await this.areaFor(input);
    const search = publicPoint(input, visibility);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE equipment_listings SET
          current_location = ${geography(input)}, search_location = ${geography(search)}, current_label = ${input.label},
          current_visibility = ${visibility}::"LocationVisibility", current_place_id = ${area.placeId}::uuid,
          current_locality = ${area.locality}, current_taluka = ${area.taluka}, current_district = ${area.district},
          current_state = ${area.state}, current_country_code = ${area.countryCode},
          current_location_updated_at = now(), updated_at = now()
        WHERE id = ${id}::uuid`;
      await this.recordLocation(tx, id, user.id, input, input.label, input.source);
    });
    return this.ownerView(id, user.id);
  }

  async setStatus(user: AuthUser, id: string, status: ListingStatus): Promise<OwnerListingDto> {
    const listing = await this.owned(user, id);
    await this.transition(listing.id, listing.status, status);
    return this.ownerView(id, user.id);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const listing = await this.owned(user, id);
    await this.transition(listing.id, listing.status, 'deleted');
  }

  async mine(userId: string, page: PageRequest & { status?: ListingStatus }): Promise<Paginated<OwnerListingDto>> {
    const status = page.status ? Prisma.sql`AND l.status = ${page.status}::"ListingStatus"` : Prisma.empty;
    const offset = (page.page - 1) * page.pageSize;
    const [rows, count] = await Promise.all([
      this.prisma.$queryRaw<OwnerRow[]>`
        SELECT ${OWNER_COLUMNS} ${LISTING_FROM}
        WHERE l.owner_id = ${userId}::uuid AND l.status <> 'deleted' ${status}
        ORDER BY l.updated_at DESC, l.id LIMIT ${page.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM equipment_listings l WHERE l.owner_id = ${userId}::uuid AND l.status <> 'deleted' ${status}`,
    ]);
    const items = await Promise.all(rows.map(async (r) => toOwner(r, await this.search.operationsOf(r.id))));
    return paginated(items, count[0]?.n ?? 0, page);
  }

  async ownerView(id: string, userId: string): Promise<OwnerListingDto> {
    const rows = await this.prisma.$queryRaw<OwnerRow[]>`
      SELECT ${OWNER_COLUMNS} ${LISTING_FROM} WHERE l.id = ${id}::uuid AND l.owner_id = ${userId}::uuid AND l.status <> 'deleted'`;
    const row = rows[0];
    if (!row) throw notFound('Listing');
    return toOwner(row, await this.search.operationsOf(id));
  }

  async history(user: AuthUser, id: string): Promise<LocationHistoryDto[]> {
    await this.owned(user, id);
    return this.prisma.$queryRaw<LocationHistoryDto[]>`
      SELECT id, label, source::text AS source, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
      FROM location_history WHERE listing_id = ${id}::uuid ORDER BY created_at DESC LIMIT 50`;
  }

  /** Ownership is derived from the session, never from client input. */
  private async owned(user: AuthUser, id: string) {
    const listing = await this.prisma.equipmentListing.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true, currentVisibility: true },
    });
    if (!listing || listing.status === 'deleted') throw notFound('Listing');
    if (listing.ownerId !== user.id) throw forbidden('You can only manage your own listings');
    return listing;
  }

  /** Compare-and-set, so two concurrent changes cannot both apply. */
  private async transition(id: string, from: ListingStatus, to: ListingStatus): Promise<void> {
    if (!OWNER_STATUS_TRANSITIONS[from].includes(to))
      throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Cannot change a ${from} listing to ${to}`);
    const res = await this.prisma.equipmentListing.updateMany({
      where: { id, status: from },
      data: { status: to, deletedAt: to === 'deleted' ? new Date() : null },
    });
    if (res.count !== 1) throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'The listing changed meanwhile. Reload and retry.');
  }

  private async assertCatalogue(categoryId: string | null, typeId: string | null, operationIds: string[]): Promise<void> {
    if (categoryId && typeId) {
      const type = await this.prisma.equipmentType.findFirst({
        where: { id: typeId, categoryId, isActive: true, category: { isActive: true } },
        select: { id: true },
      });
      if (!type) throw new AppError(400, 'INVALID_CATALOGUE_REFERENCE', 'Unknown equipment type', { equipmentTypeId: 'invalid' });
    }
    const unique = [...new Set(operationIds)];
    if (unique.length) {
      const found = await this.prisma.operation.count({ where: { id: { in: unique }, isActive: true } });
      if (found !== unique.length) throw invalidField('operationIds');
    }
  }

  /** Public area from the gazetteer (or the configured provider), never from the owner's own label. */
  private async areaFor(point: LatLng): Promise<Area> {
    const place = await this.places.nearestSettlement(point);
    if (place)
      return { placeId: place.id, locality: place.name, taluka: place.taluka, district: place.district, state: place.state, countryCode: place.countryCode.trim() };
    if (this.provider !== this.places) {
      const found = await this.provider.reverse(point);
      if (found) return { placeId: null, locality: found.name || null, taluka: found.taluka, district: found.district, state: found.state, countryCode: found.countryCode || null };
    }
    return { placeId: null, locality: null, taluka: null, district: null, state: null, countryCode: null };
  }

  private recordLocation(tx: Prisma.TransactionClient, listingId: string, userId: string, p: LatLng, label: string, source: LocationSource) {
    return tx.$executeRaw`
      INSERT INTO location_history (id, listing_id, location, label, source, changed_by_id, created_at)
      VALUES (gen_random_uuid(), ${listingId}::uuid, ${geography(p)}, ${label}, ${source}::"LocationSource", ${userId}::uuid, now())`;
  }
}
