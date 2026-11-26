import { searchSchema, type SearchData } from '@yantramitra/shared-validation';

export type RawParams = Record<string, string | string[] | undefined>;

/** Reads the explore URL. Invalid values are dropped rather than failing the page. */
export function parseSearch(raw: RawParams, fixed: Partial<Record<string, string>> = {}): SearchData {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...raw, ...fixed })) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== '') flat[k] = value;
  }
  const result = searchSchema.safeParse(flat);
  if (result.success) return result.data;
  const bad = new Set(result.error.issues.map((i) => String(i.path[0])));
  for (const key of bad) delete flat[key];
  if (bad.has('lat') || bad.has('lng')) { delete flat.lat; delete flat.lng; }
  return searchSchema.safeParse(flat).data ?? { page: 1, pageSize: 20 };
}

export const SEARCH_KEYS = ['q', 'category', 'type', 'operation', 'place', 'lat', 'lng', 'radiusKm', 'pricingType', 'priceMin', 'priceMax', 'operatorTerm', 'sort', 'page'] as const;

export function toQueryString(values: Partial<Record<string, string | number | undefined | null>>): string {
  const params = new URLSearchParams();
  for (const key of SEARCH_KEYS) {
    const v = values[key];
    if (v !== undefined && v !== null && v !== '' && !(key === 'page' && Number(v) === 1)) params.set(key, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}
