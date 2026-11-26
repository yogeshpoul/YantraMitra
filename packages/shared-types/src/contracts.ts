import type {
  CurrentVisibility, FuelTerm, HomeVisibility, ListingStatus, Locale, LocationSource, OperatorTerm, PlaceKind,
  PricingType, ReportReason, ReportStatus, TransportTerm, UserStatus,
} from './enums.js';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type LocalizedName = Record<Locale, string>;

export interface LatLng {
  lat: number;
  lng: number;
}

// ── Auth ────────────────────────────────────────────────────────────────
export interface MeDto {
  id: string;
  fullName: string;
  mobile: string;
  preferredLocale: Locale;
  mustChangePassword: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  /** Only for native clients. Web clients receive an HttpOnly cookie instead. */
  refreshToken?: string;
  user: MeDto;
}

// ── Catalogue ───────────────────────────────────────────────────────────
export interface OperationDto {
  id: string;
  slug: string;
  names: LocalizedName;
}

export interface EquipmentTypeDto extends OperationDto {
  categoryId: string;
  iconKey: string | null;
}

export interface CategoryDto extends OperationDto {
  iconKey: string;
  types: EquipmentTypeDto[];
}

export interface AdminCatalogueFields {
  sortOrder: number;
  isActive: boolean;
}
export type AdminCategoryDto = Omit<CategoryDto, 'types'> & AdminCatalogueFields;
export type AdminEquipmentTypeDto = EquipmentTypeDto & AdminCatalogueFields;
export type AdminOperationDto = OperationDto & AdminCatalogueFields;

// ── Listings ────────────────────────────────────────────────────────────
export interface PricingDto {
  type: PricingType;
  price: number | null;
  currency: string;
  negotiable: boolean;
  minHours: number | null;
  minAcres: number | null;
}

/** Gazetteer-derived area. Never contains the owner's free-text label. */
export interface PublicArea {
  locality: string | null;
  taluka: string | null;
  district: string | null;
  state: string | null;
  countryCode: string | null;
}

export interface PublicLocationDto extends PublicArea {
  /** null when the owner only shares the locality name */
  point: LatLng | null;
  precision: CurrentVisibility;
  updatedAt: string;
}

export interface ListingCardDto {
  id: string;
  path: string;
  title: string;
  status: ListingStatus;
  category: { id: string; slug: string; names: LocalizedName; iconKey: string };
  type: { id: string; slug: string; names: LocalizedName; iconKey: string | null };
  pricing: PricingDto;
  fuelTerm: FuelTerm;
  operatorTerm: OperatorTerm;
  transportTerm: TransportTerm;
  location: PublicLocationDto;
  distanceKm: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingDetailDto extends ListingCardDto {
  manufacturer: string | null;
  model: string | null;
  manufacturingYear: number | null;
  description: string | null;
  additionalConditions: string | null;
  operations: OperationDto[];
  homeArea: PublicArea | null;
  contactEnabled: boolean;
  ownerMemberSince: string;
}

export interface OwnerLocation<V> extends LatLng {
  label: string;
  visibility: V;
}

/** Full view; only ever returned to the listing owner. */
export interface OwnerListingDto extends ListingDetailDto {
  home: OwnerLocation<HomeVisibility>;
  current: OwnerLocation<CurrentVisibility>;
  allowWhatsapp: boolean;
  suspendedReason: string | null;
}

export interface LocationHistoryDto extends LatLng {
  id: string;
  label: string;
  source: LocationSource;
  createdAt: string;
}

export interface ContactDto {
  ownerName: string;
  phone: string;
  whatsappUrl: string | null;
}

// ── Locations ───────────────────────────────────────────────────────────
export interface PlaceDto extends LatLng {
  /** Present only for gazetteer places */
  slug: string | null;
  name: string;
  kind: PlaceKind;
  taluka: string | null;
  district: string | null;
  state: string | null;
  countryCode: string;
  postalCode: string | null;
  label: string;
}

export interface PlaceDetailDto extends PlaceDto {
  /** Other places sharing the same name */
  alternatives: PlaceDto[];
}

export interface LocalityDto {
  slug: string;
  name: string;
  district: string | null;
  state: string | null;
  listingCount: number;
}

export interface LocationConfigDto {
  searchProvider: 'local' | 'nominatim' | 'google';
  defaultRadiusKm: number;
  radiusPresetsKm: number[];
  maxRadiusKm: number;
  attribution: string;
}

// ── Admin ───────────────────────────────────────────────────────────────
export interface AdminDashboardDto {
  users: { total: number; active: number; suspended: number; last7Days: number };
  listings: Record<ListingStatus, number> & { last7Days: number };
  reports: { open: number; reviewing: number };
  contacts: { last7Days: number; last30Days: number };
  topDistricts: { district: string | null; state: string | null; count: number }[];
}

export interface AdminListingDto {
  id: string;
  path: string;
  title: string;
  status: ListingStatus;
  suspendedReason: string | null;
  categoryNames: LocalizedName;
  owner: { id: string; fullName: string; mobile: string; status: UserStatus };
  area: PublicArea;
  openReports: number;
  createdAt: string;
}

export interface AdminUserDto {
  id: string;
  fullName: string;
  mobile: string;
  status: UserStatus;
  isAdmin: boolean;
  mustChangePassword: boolean;
  listingCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminReportDto {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  listing: { id: string; title: string; path: string; status: ListingStatus };
  reporter: { id: string; fullName: string };
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminAuditLogDto {
  id: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface TempPasswordDto {
  temporaryPassword: string;
  expiresAt: string;
}
