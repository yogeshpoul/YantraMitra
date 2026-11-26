import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ExploreView } from '@/components/explore-view';
import { Link } from '@/i18n/navigation';
import { loadExplore } from '@/lib/explore';
import { parseSearch, type RawParams } from '@/lib/search-params';
import { localePrefix, pageMetadata } from '@/lib/seo';
import { orNotFound, revalidate, serverApi } from '@/lib/server-api';

type Props = { params: Promise<{ locale: string; place: string }>; searchParams: Promise<RawParams> };

/** Same threshold as the API's locality list: pages with fewer real listings are not indexed. */
const MIN_LISTINGS_FOR_INDEXING = 3;
const LOCALITY_RADIUS_KM = 25;

const load = (slug: string) => orNotFound(serverApi.locations.place(slug, revalidate(3600)));

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, place: slug } = await params;
  const place = await load(slug);
  const results = await serverApi.equipment.search({ place: slug, radiusKm: LOCALITY_RADIUS_KM, page: 1, pageSize: 1 }, revalidate(300));
  const t = await getTranslations({ locale, namespace: 'seo' });
  const filtered = Object.keys(await searchParams).length > 0;
  return pageMetadata({
    locale, path: `/equipment/near/${place.slug}`,
    title: t('nearTitle', { place: place.name }),
    description: t('nearDescription', { place: place.label, count: results.total }),
    index: !filtered && results.total >= MIN_LISTINGS_FOR_INDEXING,
  });
}

/** Locality landing page for any gazetteer place in the country; nothing is specific to one town. */
export default async function NearPage({ params, searchParams }: Props) {
  const { locale, place: slug } = await params;
  setRequestLocale(locale);
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) notFound();
  const place = await load(slug);
  const t = await getTranslations();
  const query = parseSearch(await searchParams, { place: place.slug ?? slug });
  const radiusKm = query.radiusKm ?? LOCALITY_RADIUS_KM;
  const data = await loadExplore({ ...query, radiusKm });

  return (
    <ExploreView {...data} basePath={`/equipment/near/${slug}`} heading={t('near.title', { place: place.name })}
      breadcrumbs={<Breadcrumbs localePrefix={localePrefix(locale)} items={[{ label: t('listing.breadcrumbHome'), href: '/' }, { label: t('nav.explore'), href: '/equipment' }, { label: place.name }]} />}
      intro={
        <div className="space-y-2 text-muted">
          <p>{place.label}</p>
          <p>{t('near.intro', { count: data.results.total, km: radiusKm, place: place.name })}</p>
          {place.alternatives.length > 0 && (
            <p>
              {t('near.otherPlaces', { name: place.name })}{' '}
              {place.alternatives.filter((a) => a.slug).map((a, i) => (
                <span key={a.slug}>{i > 0 && ' · '}<Link className="font-medium text-leaf-700 underline" href={`/equipment/near/${a.slug}`}>{a.label}</Link></span>
              ))}
            </p>
          )}
        </div>
      } />
  );
}
