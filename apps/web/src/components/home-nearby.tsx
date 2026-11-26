'use client';
import type { ListingCardDto } from '@yantramitra/shared-types';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { toQueryString } from '@/lib/search-params';
import { ListingGrid } from './listing-card';
import { useSearchLocation } from './location-context';
import { Alert, buttonClass, Skeleton } from './ui';

/** Listings near the visitor's chosen location, or the newest anywhere when none is chosen. */
export function HomeNearby() {
  const t = useTranslations();
  const { location, radiusKm, ready } = useSearchLocation();
  const [items, setItems] = useState<ListingCardDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setItems(null);
    setFailed(false);
    const query = location ? { lat: location.lat, lng: location.lng, radiusKm, pageSize: 6, page: 1 } : { sort: 'recent' as const, pageSize: 6, page: 1 };
    api.equipment.search(query).then((r) => alive && setItems(r.items), () => alive && setFailed(true));
    return () => { alive = false; };
  }, [ready, location, radiusKm]);

  const more = `/equipment${toQueryString(location ? (location.slug ? { place: location.slug, radiusKm } : { lat: location.lat, lng: location.lng, radiusKm }) : {})}`;

  return (
    <section className="container-page space-y-4 pb-12" aria-labelledby="nearby-title" aria-busy={!items && !failed}>
      <div className="flex items-end justify-between gap-4">
        <h2 id="nearby-title" className="text-2xl font-bold">
          {location ? t('home.nearbyTitle', { place: location.label.split(',')[0] ?? '' }) : t('home.nearbyTitleAnywhere')}
        </h2>
        <Link href={more} className="font-semibold text-leaf-700 hover:underline">{t('common.seeAll')}</Link>
      </div>
      {failed && <Alert tone="error">{t('state.errorText')}</Alert>}
      {!items && !failed && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80" />)}</div>}
      {items && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-soil-200 bg-white p-8 text-center">
          <p className="text-muted">{t('home.nearbyEmpty', { km: radiusKm })}</p>
          <Link href="/listings/new" className={buttonClass('secondary', 'mt-4')}>{t('home.ctaButton')}</Link>
        </div>
      )}
      {items && items.length > 0 && <ListingGrid items={items} />}
    </section>
  );
}
