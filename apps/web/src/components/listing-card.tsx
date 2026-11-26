'use client';
import type { ListingCardDto } from '@yantramitra/shared-types';
import { Clock, MapPin, Navigation, UserRound } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useAuth } from './auth-context';
import { pickName, priceLabel, shortArea } from '@/lib/format';
import { EquipmentArt } from './equipment-art';
import { FavoriteButton } from './favorite-button';
import { Badge } from './ui';

export function ListingCard({ listing, favorite }: { listing: ListingCardDto; favorite?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const typeName = pickName(listing.type.names, locale);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-soil-200 bg-white shadow-sm transition-shadow hover:shadow-md" data-testid="listing-card">
      <div className="relative flex h-36 items-center justify-center bg-linear-to-b from-leaf-50 to-soil-100">
        <EquipmentArt iconKey={listing.type.iconKey} fallbackKey={listing.category.iconKey} className="h-28 w-auto" />
        <div className="absolute left-3 top-3">
          <Badge tone={listing.status === 'active' ? 'green' : 'amber'}>{t(`listing.status.${listing.status}`)}</Badge>
        </div>
        {favorite !== undefined && <div className="absolute right-2 top-2"><FavoriteButton listingId={listing.id} initial={favorite} compact /></div>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm font-medium text-leaf-700">{typeName}</p>
        <h3 className="text-lg font-semibold leading-snug">
          <Link href={listing.path} className="after:absolute after:inset-0 focus-visible:outline-none">{listing.title}</Link>
        </h3>
        <p className="text-xl font-bold text-ink">
          {priceLabel(listing.pricing, t, locale)}
          {listing.pricing.negotiable && listing.pricing.price != null && <span className="ml-2 text-sm font-normal text-muted">{t('pricing.negotiable')}</span>}
        </p>
        <ul className="mt-auto space-y-1 text-sm text-muted">
          <li className="flex items-center gap-1.5"><MapPin className="size-4 shrink-0 text-leaf-600" aria-hidden />
            <span className="truncate">{shortArea(listing.location, t('location.unknownArea'))}</span>
            {listing.distanceKm != null && <span className="ml-auto flex shrink-0 items-center gap-1 font-semibold text-ink"><Navigation className="size-3.5" aria-hidden />{t('listing.distance', { km: listing.distanceKm })}</span>}
          </li>
          <li className="flex items-center gap-1.5"><UserRound className="size-4 shrink-0 text-leaf-600" aria-hidden />{t(`terms.operatorValues.${listing.operatorTerm}`)}</li>
          <li className="flex items-center gap-1.5"><Clock className="size-4 shrink-0 text-leaf-600" aria-hidden />
            <span suppressHydrationWarning>{t('listing.updated', { time: format.relativeTime(new Date(listing.location.updatedAt), new Date()) })}</span></li>
        </ul>
      </div>
    </article>
  );
}

/** Saved-listing IDs for the signed-in user; null while unknown. */
function useFavoriteIds(): Set<string> | null {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    let alive = true;
    api.users.favoriteIds().then((r) => alive && setIds(new Set(r)), () => alive && setIds(new Set()));
    return () => { alive = false; };
  }, [user]);
  return ids;
}

export function ListingGrid({ items }: { items: ListingCardDto[] }) {
  const ids = useFavoriteIds();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((l) => (
        <li key={`${l.id}-${ids ? 'f' : 'p'}`}><ListingCard listing={l} favorite={ids?.has(l.id) ?? false} /></li>
      ))}
    </ul>
  );
}
