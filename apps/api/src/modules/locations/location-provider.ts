import type { LatLng, PlaceDto } from '@yantramitra/shared-types';

/** Place search abstraction. The default (`local`) is free, offline and needs no API key. */
export interface LocationProvider {
  search(query: string, limit: number): Promise<PlaceDto[]>;
  reverse(point: LatLng): Promise<PlaceDto | null>;
}

export const LOCATION_PROVIDER = Symbol('LOCATION_PROVIDER');
