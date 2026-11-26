import {
  CLIENT_CONTACT_EVENTS, CURRENT_VISIBILITIES, FUEL_TERMS, HOME_VISIBILITIES, ICON_KEYS, LISTING_STATUSES, LOCALES,
  LOCATION_SOURCES, MAX_RADIUS_KM, MIN_RADIUS_KM, OPERATOR_TERMS, PRICING_TYPES, REPORT_REASONS, REPORT_STATUSES,
  SORT_OPTIONS, TRANSPORT_TERMS, USER_STATUSES,
} from '@yantramitra/shared-types';
import { z } from 'zod';
import { normalizePhone } from './phone.js';

/**
 * Error messages are translation keys (`validation.<key>`), never display text.
 */
export const LIMITS = {
  nameMin: 2, nameMax: 80, passwordMin: 8, passwordMax: 72, titleMin: 5, titleMax: 100, descriptionMax: 2000,
  conditionsMax: 1000, labelMax: 160, makerMax: 60, priceMax: 9_999_999, yearMin: 1950,
} as const;

const text = (min: number, max: number) =>
  z.string({ error: 'required' }).trim().min(min, min <= 1 ? 'required' : 'tooShort').max(max, 'tooLong');
const optionalText = (max: number) =>
  z.string().trim().max(max, 'tooLong').nullish().transform((v) => v || null);
const uuid = z.uuid('invalid');
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slugFormat').max(80, 'tooLong');

// ── Auth ────────────────────────────────────────────────────────────────
export const mobileSchema = z
  .string({ error: 'required' })
  .trim()
  .min(1, 'required')
  .max(24, 'phoneInvalid')
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'phoneInvalid' });
      return z.NEVER;
    }
    return phone;
  });

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', '11111111', '00000000',
  '87654321', 'qwertyui', 'qwerty123', 'abcd1234', 'abc12345', 'india123', 'farmer123', 'yantramitra',
]);

export const newPasswordSchema = z
  .string({ error: 'required' })
  .min(LIMITS.passwordMin, 'passwordTooShort')
  .max(LIMITS.passwordMax, 'tooLong')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()) && new Set(v).size > 3, 'passwordTooCommon');

export const registerSchema = z
  .object({
    fullName: text(LIMITS.nameMin, LIMITS.nameMax),
    mobile: mobileSchema,
    password: newPasswordSchema,
    confirmPassword: z.string({ error: 'required' }),
    preferredLocale: z.enum(LOCALES, 'invalid'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'passwordMismatch' });

export const loginSchema = z.object({
  mobile: mobileSchema,
  password: z.string({ error: 'required' }).min(1, 'required').max(200, 'tooLong'),
});

export const refreshSchema = z.object({ refreshToken: z.string().max(300).optional() });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'required' }).min(1, 'required').max(200, 'tooLong'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string({ error: 'required' }),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'passwordMismatch' });

export const updateProfileSchema = z
  .object({ fullName: text(LIMITS.nameMin, LIMITS.nameMax), preferredLocale: z.enum(LOCALES, 'invalid') })
  .partial();

// ── Locations ───────────────────────────────────────────────────────────
export const latSchema = z.coerce.number({ error: 'coordinateInvalid' }).min(-90, 'coordinateInvalid').max(90, 'coordinateInvalid');
export const lngSchema = z.coerce.number({ error: 'coordinateInvalid' }).min(-180, 'coordinateInvalid').max(180, 'coordinateInvalid');

// Coordinates in bodies must be real numbers; coercion would turn null into 0,0.
const bodyLat = z.number({ error: 'coordinateInvalid' }).min(-90, 'coordinateInvalid').max(90, 'coordinateInvalid');
const bodyLng = z.number({ error: 'coordinateInvalid' }).min(-180, 'coordinateInvalid').max(180, 'coordinateInvalid');

const locationBase = {
  lat: bodyLat,
  lng: bodyLng,
  label: text(1, LIMITS.labelMax),
  source: z.enum(LOCATION_SOURCES, 'invalid').default('manual'),
};
export const homeLocationSchema = z.object({ ...locationBase, visibility: z.enum(HOME_VISIBILITIES, 'invalid').default('hidden') });
export const currentLocationSchema = z.object({
  ...locationBase,
  visibility: z.enum(CURRENT_VISIBILITIES, 'invalid').default('approximate'),
});
/** Location update: visibility is kept unless provided. */
export const updateLocationSchema = z.object({ ...locationBase, visibility: z.enum(CURRENT_VISIBILITIES, 'invalid').optional() });

// ── Listings ────────────────────────────────────────────────────────────
const price = z
  .number({ error: 'numberInvalid' })
  .positive('positive')
  .max(LIMITS.priceMax, 'tooLarge')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'twoDecimals');
const minimum = z.number({ error: 'numberInvalid' }).positive('positive').max(9999, 'tooLarge').nullish().transform((v) => v ?? null);

export const listingInfoShape = {
  categoryId: uuid,
  equipmentTypeId: uuid,
  title: text(LIMITS.titleMin, LIMITS.titleMax),
  manufacturer: optionalText(LIMITS.makerMax),
  model: optionalText(LIMITS.makerMax),
  manufacturingYear: z
    .number({ error: 'numberInvalid' })
    .int('numberInvalid')
    .min(LIMITS.yearMin, 'yearInvalid')
    .refine((y) => y <= new Date().getFullYear() + 1, 'yearInvalid')
    .nullish()
    .transform((v) => v ?? null),
  description: optionalText(LIMITS.descriptionMax),
};
export const listingOperationsShape = { operationIds: z.array(uuid).min(1, 'selectOne').max(30, 'tooLong') };
export const listingPricingShape = {
  pricingType: z.enum(PRICING_TYPES, 'required'),
  price: price.nullish().transform((v) => v ?? null),
  isNegotiable: z.boolean().default(false),
  minHours: minimum,
  minAcres: minimum,
};
export const listingConditionsShape = {
  fuelTerm: z.enum(FUEL_TERMS, 'required'),
  operatorTerm: z.enum(OPERATOR_TERMS, 'required'),
  transportTerm: z.enum(TRANSPORT_TERMS, 'required'),
  additionalConditions: optionalText(LIMITS.conditionsMax),
};
export const listingLocationShape = { home: homeLocationSchema, current: currentLocationSchema };
export const listingContactShape = { contactEnabled: z.boolean().default(true), allowWhatsapp: z.boolean().default(true) };

const pricingRule = (v: { pricingType?: string; price?: number | null }, ctx: z.RefinementCtx) => {
  if (v.pricingType === undefined) return;
  if (v.pricingType === 'contact_for_price' && v.price != null)
    ctx.addIssue({ code: 'custom', path: ['price'], message: 'priceNotAllowed' });
  if (v.pricingType !== 'contact_for_price' && v.price == null)
    ctx.addIssue({ code: 'custom', path: ['price'], message: 'required' });
};

export const listingStepSchemas = {
  info: z.object(listingInfoShape),
  operations: z.object(listingOperationsShape),
  pricing: z.object(listingPricingShape).superRefine(pricingRule),
  conditions: z.object(listingConditionsShape),
  location: z.object(listingLocationShape),
  contact: z.object(listingContactShape),
} as const;

export const createListingSchema = z
  .object({
    ...listingInfoShape, ...listingOperationsShape, ...listingPricingShape, ...listingConditionsShape,
    ...listingLocationShape, ...listingContactShape,
  })
  .superRefine(pricingRule);

/**
 * Partial edit. Current location is deliberately absent: it changes only through
 * PATCH /equipment/:id/location, so it always produces history and never touches home.
 * Category and type travel together, as do pricing type and price.
 */
export const updateListingSchema = z
  .object({
    categoryId: uuid.optional(),
    equipmentTypeId: uuid.optional(),
    title: listingInfoShape.title.optional(),
    manufacturer: z.string().trim().max(LIMITS.makerMax, 'tooLong').nullable().optional(),
    model: z.string().trim().max(LIMITS.makerMax, 'tooLong').nullable().optional(),
    manufacturingYear: z.number().int('numberInvalid').min(LIMITS.yearMin, 'yearInvalid').max(2100, 'yearInvalid').nullable().optional(),
    description: z.string().trim().max(LIMITS.descriptionMax, 'tooLong').nullable().optional(),
    operationIds: listingOperationsShape.operationIds.optional(),
    pricingType: z.enum(PRICING_TYPES).optional(),
    price: price.nullable().optional(),
    isNegotiable: z.boolean().optional(),
    minHours: z.number().positive('positive').max(9999, 'tooLarge').nullable().optional(),
    minAcres: z.number().positive('positive').max(9999, 'tooLarge').nullable().optional(),
    fuelTerm: z.enum(FUEL_TERMS).optional(),
    operatorTerm: z.enum(OPERATOR_TERMS).optional(),
    transportTerm: z.enum(TRANSPORT_TERMS).optional(),
    additionalConditions: z.string().trim().max(LIMITS.conditionsMax, 'tooLong').nullable().optional(),
    home: homeLocationSchema.optional(),
    contactEnabled: z.boolean().optional(),
    allowWhatsapp: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.categoryId === undefined) !== (v.equipmentTypeId === undefined))
      ctx.addIssue({ code: 'custom', path: ['equipmentTypeId'], message: 'required' });
    if (v.pricingType === undefined && v.price !== undefined)
      ctx.addIssue({ code: 'custom', path: ['pricingType'], message: 'required' });
    pricingRule(v, ctx);
  });

export const listingStatusSchema = z.object({ status: z.enum(['active', 'inactive', 'unavailable'], 'invalid') });

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const optionalQuery = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

export const paginationShape = {
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
};
export const paginationSchema = z.object(paginationShape);

export const searchShape = {
  q: optionalQuery(z.string().trim().max(80, 'tooLong')),
  category: optionalQuery(slug),
  type: optionalQuery(slug),
  operation: optionalQuery(slug),
  place: optionalQuery(z.string().max(160)),
  lat: optionalQuery(latSchema),
  lng: optionalQuery(lngSchema),
  radiusKm: optionalQuery(z.coerce.number().min(MIN_RADIUS_KM, 'radiusInvalid').max(MAX_RADIUS_KM, 'radiusInvalid')),
  pricingType: optionalQuery(z.enum(PRICING_TYPES)),
  priceMin: optionalQuery(z.coerce.number().min(0).max(LIMITS.priceMax)),
  priceMax: optionalQuery(z.coerce.number().min(0).max(LIMITS.priceMax)),
  operatorTerm: optionalQuery(z.enum(OPERATOR_TERMS)),
  sort: optionalQuery(z.enum(SORT_OPTIONS)),
  ...paginationShape,
};
const pairedPoint = (v: { lat?: unknown; lng?: unknown }, ctx: z.RefinementCtx) => {
  if ((v.lat === undefined) !== (v.lng === undefined))
    ctx.addIssue({ code: 'custom', path: [v.lat === undefined ? 'lat' : 'lng'], message: 'coordinateInvalid' });
};
export const searchSchema = z.object(searchShape).superRefine(pairedPoint);
export const nearbySchema = z.object({ ...searchShape, lat: latSchema, lng: lngSchema });

export const placeSearchSchema = z.object({
  q: z.string().trim().min(2, 'tooShort').max(80, 'tooLong'),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
export const reverseSchema = z.object({ lat: latSchema, lng: lngSchema });

export const contactEventSchema = z.object({ type: z.enum(CLIENT_CONTACT_EVENTS, 'invalid') });
export const reportSchema = z.object({ reason: z.enum(REPORT_REASONS, 'required'), details: optionalText(1000) });

// ── Admin ───────────────────────────────────────────────────────────────
export const adminListingsQuerySchema = z.object({
  q: optionalQuery(z.string().trim().max(80)),
  status: optionalQuery(z.enum(LISTING_STATUSES)),
  ...paginationShape,
});
export const adminUsersQuerySchema = z.object({
  q: optionalQuery(z.string().trim().max(80)),
  status: optionalQuery(z.enum(USER_STATUSES)),
  ...paginationShape,
});
export const adminReportsQuerySchema = z.object({ status: optionalQuery(z.enum(REPORT_STATUSES)), ...paginationShape });
export const adminAuditQuerySchema = z.object({
  action: optionalQuery(z.string().max(60)),
  entityId: optionalQuery(z.uuid()),
  ...paginationShape,
});
export const adminListingStatusSchema = z
  .object({ status: z.enum(['suspended', 'active', 'inactive'], 'invalid'), reason: optionalText(300) })
  .refine((v) => v.status !== 'suspended' || v.reason, { path: ['reason'], message: 'required' });
export const adminUserStatusSchema = z
  .object({ status: z.enum(['active', 'suspended'], 'invalid'), reason: optionalText(300) })
  .refine((v) => v.status !== 'suspended' || v.reason, { path: ['reason'], message: 'required' });
export const adminReportUpdateSchema = z.object({
  status: z.enum(['reviewing', 'resolved', 'dismissed'], 'invalid'),
  resolutionNote: optionalText(1000),
});

const namesSchema = z.object({ en: text(1, 80), mr: text(1, 80), hi: text(1, 80) });
const catalogueShape = { slug, names: namesSchema, sortOrder: z.number().int().min(0).max(9999), isActive: z.boolean() };
/** `near` is a reserved route segment on the website. */
const categorySlug = slug.refine((s) => s !== 'near', 'slugReserved');
export const createCategorySchema = z.object({
  ...catalogueShape, slug: categorySlug, iconKey: z.enum(ICON_KEYS),
  sortOrder: catalogueShape.sortOrder.default(100), isActive: z.boolean().default(true),
});
export const updateCategorySchema = z.object({ ...catalogueShape, slug: categorySlug, iconKey: z.enum(ICON_KEYS) }).partial();
export const createEquipmentTypeSchema = z.object({
  ...catalogueShape, categoryId: uuid, iconKey: z.enum(ICON_KEYS).nullable().default(null),
  sortOrder: catalogueShape.sortOrder.default(100), isActive: z.boolean().default(true),
});
/** A type cannot move between categories because listings reference the pair. */
export const updateEquipmentTypeSchema = z.object({ ...catalogueShape, iconKey: z.enum(ICON_KEYS).nullable() }).partial();
export const createOperationSchema = z.object({
  ...catalogueShape, sortOrder: catalogueShape.sortOrder.default(100), isActive: z.boolean().default(true),
});
export const updateOperationSchema = z.object(catalogueShape).partial();

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type CreateListingInput = z.input<typeof createListingSchema>;
export type CreateListingData = z.output<typeof createListingSchema>;
export type UpdateListingInput = z.input<typeof updateListingSchema>;
export type UpdateListingData = z.output<typeof updateListingSchema>;
export type UpdateLocationInput = z.input<typeof updateLocationSchema>;
export type SearchQuery = Partial<z.output<typeof searchSchema>>;
export type SearchData = z.output<typeof searchSchema>;

/** Flattens a Zod error to field path → message key. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    out[path] ??= VALIDATION_KEYS.has(issue.message) ? issue.message : 'invalid';
  }
  return out;
}

export const VALIDATION_KEYS: ReadonlySet<string> = new Set([
  'required', 'tooShort', 'tooLong', 'invalid', 'phoneInvalid', 'passwordTooShort', 'passwordTooCommon', 'passwordMismatch',
  'coordinateInvalid', 'numberInvalid', 'positive', 'tooLarge', 'twoDecimals', 'yearInvalid', 'selectOne', 'priceNotAllowed',
  'radiusInvalid', 'slugFormat', 'slugReserved',
]);
