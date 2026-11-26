import { LOCALES, type ListingCardDto } from '@yantramitra/shared-types';
import type { MetadataRoute } from 'next';
import { localeUrl } from '@/lib/seo';
import { serverApi } from '@/lib/server-api';

export const revalidate = 3600;

/**
 * Only pages with real content: home, explore, categories and types, active listings, and locality pages
 * that have enough listings nearby (derived from live data, so any town in India can appear).
 * Filter combinations are never listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entry = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: localeUrl('mr', path),
    lastModified,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, localeUrl(l, path)])) },
  });

  const [categories, localities] = await Promise.all([
    serverApi.catalogue.categories().catch(() => []),
    serverApi.locations.localities().catch(() => []),
  ]);

  const listings: ListingCardDto[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await serverApi.equipment.search({ sort: 'recent', page, pageSize: 50 }).catch(() => null);
    if (!r) break;
    listings.push(...r.items);
    if (page >= r.totalPages) break;
  }

  return [
    entry('/'),
    entry('/equipment'),
    ...categories.flatMap((c) => [entry(`/equipment/${c.slug}`), ...c.types.map((t) => entry(`/equipment/${c.slug}/${t.slug}`))]),
    ...localities.map((l) => entry(`/equipment/near/${l.slug}`)),
    ...listings.map((l) => entry(l.path, l.updatedAt)),
  ];
}
