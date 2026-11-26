export const LOCALES = ['mr', 'hi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
/** Suggested initial language. Users can change it at any time. */
export const DEFAULT_LOCALE: Locale = 'mr';

export const USER_STATUSES = ['active', 'suspended', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LISTING_STATUSES = ['active', 'inactive', 'unavailable', 'suspended', 'deleted'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const PRICING_TYPES = ['hourly', 'per_acre', 'per_day', 'fixed', 'contact_for_price'] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export const FUEL_TERMS = ['included', 'excluded', 'negotiated', 'not_applicable'] as const;
export type FuelTerm = (typeof FUEL_TERMS)[number];

export const OPERATOR_TERMS = ['included', 'extra_cost', 'equipment_only', 'not_applicable'] as const;
export type OperatorTerm = (typeof OPERATOR_TERMS)[number];

export const TRANSPORT_TERMS = ['included', 'extra_cost', 'negotiated', 'not_applicable'] as const;
export type TransportTerm = (typeof TRANSPORT_TERMS)[number];

export const HOME_VISIBILITIES = ['hidden', 'locality_only'] as const;
export type HomeVisibility = (typeof HOME_VISIBILITIES)[number];

export const CURRENT_VISIBILITIES = ['approximate', 'locality_only', 'exact'] as const;
export type CurrentVisibility = (typeof CURRENT_VISIBILITIES)[number];

export const LOCATION_VISIBILITIES = ['exact', 'approximate', 'locality_only', 'hidden'] as const;
export type LocationVisibility = (typeof LOCATION_VISIBILITIES)[number];

export const LOCATION_SOURCES = ['gps', 'map', 'search', 'manual'] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const REPORT_REASONS = ['fake', 'wrong_information', 'not_available', 'duplicate', 'offensive', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** `reveal` is recorded by the server only. */
export const CLIENT_CONTACT_EVENTS = ['call_click', 'whatsapp_click'] as const;
export type ClientContactEvent = (typeof CLIENT_CONTACT_EVENTS)[number];

export const SORT_OPTIONS = ['nearest', 'recent', 'price_asc', 'price_desc'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const RADIUS_PRESETS_KM = [5, 10, 25, 50, 100] as const;
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 500;

export const PLACE_KINDS = ['village', 'town', 'city', 'taluka', 'district', 'state', 'postal'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const ICON_KEYS = [
  'tractor', 'tillage', 'sowing', 'spraying', 'drone', 'harvesting', 'excavation',
  'transport', 'irrigation', 'levelling', 'other',
] as const;
export type IconKey = (typeof ICON_KEYS)[number];

/** Single source of truth for listing status transitions. */
export const OWNER_STATUS_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  active: ['inactive', 'unavailable', 'deleted'],
  inactive: ['active', 'unavailable', 'deleted'],
  unavailable: ['active', 'inactive', 'deleted'],
  suspended: ['deleted'],
  deleted: [],
};

export const ADMIN_STATUS_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  active: ['suspended'],
  inactive: ['suspended'],
  unavailable: ['suspended'],
  suspended: ['active', 'inactive'],
  deleted: [],
};
