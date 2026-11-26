import { Logger } from '@nestjs/common';
import type { LatLng, PlaceDto, PlaceKind } from '@yantramitra/shared-types';
import type { LocationProvider } from './location-provider.js';

const TIMEOUT_MS = 5000;

function label(parts: (string | null | undefined)[]): string {
  const clean = parts.filter((v): v is string => Boolean(v));
  return clean.filter((v, i) => clean.indexOf(v) === i).join(', ');
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  addresstype?: string;
  address?: Record<string, string>;
}

/** OpenStreetMap Nominatim. Public instance: max 1 request/second; self-host for production volume. */
export class NominatimProvider implements LocationProvider {
  private readonly logger = new Logger('Nominatim');
  private last = 0;

  constructor(private readonly baseUrl: string, private readonly userAgent: string) {}

  async search(query: string, limit: number): Promise<PlaceDto[]> {
    const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: String(limit) });
    const rows = await this.call<NominatimResult[]>(`/search?${params}`);
    return (rows ?? []).map((r) => this.toPlace(r));
  }

  async reverse(p: LatLng): Promise<PlaceDto | null> {
    const params = new URLSearchParams({ lat: String(p.lat), lon: String(p.lng), format: 'jsonv2', addressdetails: '1', zoom: '14' });
    const row = await this.call<NominatimResult>(`/reverse?${params}`);
    return row?.lat ? this.toPlace(row) : null;
  }

  private async call<T>(path: string): Promise<T | null> {
    const wait = this.last + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();
    const result = await getJson<T>(`${this.baseUrl}${path}`, { 'User-Agent': this.userAgent });
    if (result === null) this.logger.warn('Nominatim request failed');
    return result;
  }

  private toPlace(r: NominatimResult): PlaceDto {
    const a = r.address ?? {};
    const name = a.village ?? a.town ?? a.city ?? a.hamlet ?? a.suburb ?? r.name ?? a.county ?? a.state ?? '';
    const kind: PlaceKind = a.city ? 'city' : a.town ? 'town' : a.village || a.hamlet ? 'village' : a.state_district ? 'district' : 'state';
    const district = a.state_district ?? null;
    return {
      slug: null, name, kind, taluka: a.county ?? null, district, state: a.state ?? null,
      countryCode: (a.country_code ?? '').toUpperCase(), postalCode: a.postcode ?? null,
      lat: Number(r.lat), lng: Number(r.lon), label: label([name, a.county, district, a.state]),
    };
  }
}

interface GoogleResult {
  geometry: { location: { lat: number; lng: number } };
  address_components: { long_name: string; short_name: string; types: string[] }[];
}

/** Google Geocoding API. Optional and billed; only used when LOCATION_PROVIDER=google. */
export class GoogleProvider implements LocationProvider {
  constructor(private readonly key: string) {}

  async search(query: string, limit: number): Promise<PlaceDto[]> {
    const params = new URLSearchParams({ address: query, key: this.key });
    const data = await getJson<{ results: GoogleResult[] }>(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    return (data?.results ?? []).slice(0, limit).map((r) => this.toPlace(r));
  }

  async reverse(p: LatLng): Promise<PlaceDto | null> {
    const params = new URLSearchParams({ latlng: `${p.lat},${p.lng}`, key: this.key });
    const data = await getJson<{ results: GoogleResult[] }>(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const first = data?.results[0];
    return first ? this.toPlace(first) : null;
  }

  private toPlace(r: GoogleResult): PlaceDto {
    const find = (type: string) => r.address_components.find((c) => c.types.includes(type));
    const locality = find('locality')?.long_name ?? find('sublocality')?.long_name ?? null;
    const taluka = find('administrative_area_level_3')?.long_name ?? null;
    const district = find('administrative_area_level_2')?.long_name ?? null;
    const state = find('administrative_area_level_1')?.long_name ?? null;
    const name = locality ?? taluka ?? district ?? state ?? '';
    return {
      slug: null, name, kind: locality ? 'town' : district ? 'district' : 'state', taluka, district, state,
      countryCode: find('country')?.short_name ?? '', postalCode: find('postal_code')?.long_name ?? null,
      lat: r.geometry.location.lat, lng: r.geometry.location.lng, label: label([name, taluka, district, state]),
    };
  }
}
