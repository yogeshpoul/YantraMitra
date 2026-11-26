import {
  listingPath, type CurrentVisibility, type FuelTerm, type HomeVisibility, type ListingCardDto, type ListingDetailDto,
  type ListingStatus, type OperatorTerm, type OwnerListingDto, type PricingType, type PublicArea, type TransportTerm,
} from '@yantramitra/shared-types';
import { Prisma } from '../../generated/prisma/client.js';

/** Columns safe for any visitor. Private columns (labels, exact points, owner) are not selected here. */
export const CARD_COLUMNS = Prisma.sql`
  l.id, l.title, l.status::text AS status, l.pricing_type::text AS "pricingType", l.price::float8 AS price, l.currency,
  l.is_negotiable AS "isNegotiable", l.min_hours::float8 AS "minHours", l.min_acres::float8 AS "minAcres",
  l.fuel_term::text AS "fuelTerm", l.operator_term::text AS "operatorTerm", l.transport_term::text AS "transportTerm",
  l.current_visibility::text AS "currentVisibility", l.current_locality AS "currentLocality", l.current_taluka AS "currentTaluka",
  l.current_district AS "currentDistrict", l.current_state AS "currentState", l.current_country_code AS "currentCountryCode",
  ST_Y(l.search_location::geometry) AS "searchLat", ST_X(l.search_location::geometry) AS "searchLng",
  l.current_location_updated_at AS "locationUpdatedAt", l.created_at AS "createdAt", l.updated_at AS "updatedAt",
  c.id AS "categoryId", c.slug AS "categorySlug", c.name_en AS "categoryNameEn", c.name_mr AS "categoryNameMr",
  c.name_hi AS "categoryNameHi", c.icon_key AS "categoryIcon",
  t.id AS "typeId", t.slug AS "typeSlug", t.name_en AS "typeNameEn", t.name_mr AS "typeNameMr", t.name_hi AS "typeNameHi",
  t.icon_key AS "typeIcon"`;

export const DETAIL_COLUMNS = Prisma.sql`${CARD_COLUMNS},
  l.manufacturer, l.model, l.manufacturing_year AS "manufacturingYear", l.description,
  l.additional_conditions AS "additionalConditions", l.contact_enabled AS "contactEnabled",
  l.home_visibility::text AS "homeVisibility", hp.name AS "homeLocality", hp.taluka AS "homeTaluka",
  hp.district AS "homeDistrict", hp.state AS "homeState", hp.country_code AS "homeCountryCode",
  u.created_at AS "ownerSince"`;

/** Owner only. */
export const OWNER_COLUMNS = Prisma.sql`${DETAIL_COLUMNS},
  ST_Y(l.home_location::geometry) AS "homeLat", ST_X(l.home_location::geometry) AS "homeLng", l.home_label AS "homeLabel",
  ST_Y(l.current_location::geometry) AS "currentLat", ST_X(l.current_location::geometry) AS "currentLng",
  l.current_label AS "currentLabel", l.allow_whatsapp AS "allowWhatsapp", l.suspended_reason AS "suspendedReason"`;

export const LISTING_FROM = Prisma.sql`
  FROM equipment_listings l
  JOIN equipment_categories c ON c.id = l.category_id
  JOIN equipment_types t ON t.id = l.equipment_type_id
  JOIN users u ON u.id = l.owner_id
  LEFT JOIN places hp ON hp.id = l.home_place_id`;

export interface CardRow {
  id: string;
  title: string;
  status: ListingStatus;
  pricingType: PricingType;
  price: number | null;
  currency: string;
  isNegotiable: boolean;
  minHours: number | null;
  minAcres: number | null;
  fuelTerm: FuelTerm;
  operatorTerm: OperatorTerm;
  transportTerm: TransportTerm;
  currentVisibility: CurrentVisibility;
  currentLocality: string | null;
  currentTaluka: string | null;
  currentDistrict: string | null;
  currentState: string | null;
  currentCountryCode: string | null;
  searchLat: number;
  searchLng: number;
  locationUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  categoryId: string;
  categorySlug: string;
  categoryNameEn: string;
  categoryNameMr: string;
  categoryNameHi: string;
  categoryIcon: string;
  typeId: string;
  typeSlug: string;
  typeNameEn: string;
  typeNameMr: string;
  typeNameHi: string;
  typeIcon: string | null;
  distanceM?: number | null;
}

export interface DetailRow extends CardRow {
  manufacturer: string | null;
  model: string | null;
  manufacturingYear: number | null;
  description: string | null;
  additionalConditions: string | null;
  contactEnabled: boolean;
  homeVisibility: HomeVisibility;
  homeLocality: string | null;
  homeTaluka: string | null;
  homeDistrict: string | null;
  homeState: string | null;
  homeCountryCode: string | null;
  ownerSince: Date;
}

export interface OwnerRow extends DetailRow {
  homeLat: number;
  homeLng: number;
  homeLabel: string;
  currentLat: number;
  currentLng: number;
  currentLabel: string;
  allowWhatsapp: boolean;
  suspendedReason: string | null;
}

const round = (v: number, digits: number) => Number(v.toFixed(digits));

export function toCard(r: CardRow): ListingCardDto {
  return {
    id: r.id,
    path: listingPath(r.categorySlug, r.typeSlug, r.id),
    title: r.title,
    status: r.status,
    category: { id: r.categoryId, slug: r.categorySlug, names: { en: r.categoryNameEn, mr: r.categoryNameMr, hi: r.categoryNameHi }, iconKey: r.categoryIcon },
    type: { id: r.typeId, slug: r.typeSlug, names: { en: r.typeNameEn, mr: r.typeNameMr, hi: r.typeNameHi }, iconKey: r.typeIcon },
    pricing: {
      type: r.pricingType, price: r.price, currency: r.currency.trim(), negotiable: r.isNegotiable,
      minHours: r.minHours, minAcres: r.minAcres,
    },
    fuelTerm: r.fuelTerm,
    operatorTerm: r.operatorTerm,
    transportTerm: r.transportTerm,
    location: {
      locality: r.currentLocality, taluka: r.currentTaluka, district: r.currentDistrict, state: r.currentState,
      countryCode: r.currentCountryCode?.trim() ?? null,
      // Already the public projection; locality-only listings publish no coordinates at all.
      point: r.currentVisibility === 'locality_only' ? null : { lat: round(r.searchLat, 5), lng: round(r.searchLng, 5) },
      precision: r.currentVisibility,
      updatedAt: r.locationUpdatedAt.toISOString(),
    },
    // Rounded, and measured to the public projection only.
    distanceKm: r.distanceM == null ? null : round(r.distanceM / 1000, 1),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toDetail(r: DetailRow, operations: ListingDetailDto['operations']): ListingDetailDto {
  const homeArea: PublicArea | null =
    r.homeVisibility === 'locality_only' && r.homeLocality
      ? { locality: r.homeLocality, taluka: r.homeTaluka, district: r.homeDistrict, state: r.homeState, countryCode: r.homeCountryCode?.trim() ?? null }
      : null;
  return {
    ...toCard(r),
    manufacturer: r.manufacturer,
    model: r.model,
    manufacturingYear: r.manufacturingYear,
    description: r.description,
    additionalConditions: r.additionalConditions,
    operations,
    homeArea,
    contactEnabled: r.contactEnabled,
    // Month precision only: enough for trust, not identifying.
    ownerMemberSince: r.ownerSince.toISOString().slice(0, 7),
  };
}

export function toOwner(r: OwnerRow, operations: ListingDetailDto['operations']): OwnerListingDto {
  return {
    ...toDetail(r, operations),
    home: { lat: r.homeLat, lng: r.homeLng, label: r.homeLabel, visibility: r.homeVisibility },
    current: { lat: r.currentLat, lng: r.currentLng, label: r.currentLabel, visibility: r.currentVisibility },
    allowWhatsapp: r.allowWhatsapp,
    suspendedReason: r.suspendedReason,
  };
}
