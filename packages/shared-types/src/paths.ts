const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const TRAILING_UUID = new RegExp(`(?:^|-)(${UUID})$`, 'i');

/** Stable SEO path. Built from catalogue slugs so it does not change when the owner edits the title. */
export function listingPath(categorySlug: string, typeSlug: string, id: string): string {
  return `/equipment/${categorySlug}/${typeSlug}-${id}`;
}

export function listingIdFromSlug(slug: string): string | null {
  return TRAILING_UUID.exec(slug)?.[1]?.toLowerCase() ?? null;
}

/** Google Maps link using only public data. Works without any API key. */
export function googleMapsUrl(input: { point: { lat: number; lng: number } | null; areaText: string }): string {
  const query = input.point ? `${input.point.lat},${input.point.lng}` : input.areaText;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function areaText(area: {
  locality: string | null;
  taluka?: string | null;
  district: string | null;
  state: string | null;
}): string {
  const parts = [area.locality, area.taluka, area.district, area.state].filter((p): p is string => Boolean(p));
  return parts.filter((p, i) => parts.indexOf(p) === i).join(', ');
}

/**
 * Accepts only same-site relative paths, so a `next` parameter cannot be used as an open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is being rejected
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
