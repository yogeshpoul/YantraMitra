import 'server-only';
import { ApiError } from '@yantramitra/api-client';
import type { SearchData } from '@yantramitra/shared-validation';
import type { SearchLocation } from '@/components/location-context';
import { revalidate, serverApi } from './server-api';

/** Loads everything an explore-style page needs. An unknown place falls back to all locations. */
export async function loadExplore(query: SearchData) {
  const [categories, operations] = await Promise.all([
    serverApi.catalogue.categories(revalidate(300)),
    serverApi.catalogue.operations(revalidate(300)),
  ]);
  let urlLocation: SearchLocation | null = null;
  let effective = query;
  if (query.place) {
    try {
      const place = await serverApi.locations.place(query.place, revalidate(3600));
      urlLocation = { source: 'place', label: place.label, lat: place.lat, lng: place.lng, slug: place.slug };
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) throw e;
      effective = { ...query, place: undefined };
    }
  } else if (query.lat !== undefined && query.lng !== undefined) {
    urlLocation = { source: 'gps', label: `${query.lat.toFixed(3)}, ${query.lng.toFixed(3)}`, lat: query.lat, lng: query.lng, slug: null };
  }
  const results = await serverApi.equipment.search(effective, { cache: 'no-store' });
  return { categories, operations, results, urlLocation, query: effective };
}
