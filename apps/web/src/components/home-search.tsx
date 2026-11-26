'use client';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toQueryString } from '@/lib/search-params';
import { LocationBar } from './location-bar';
import { useSearchLocation } from './location-context';
import { Button, Input } from './ui';

export function HomeSearch() {
  const t = useTranslations();
  const router = useRouter();
  const { location, radiusKm } = useSearchLocation();
  const [q, setQ] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const where = location?.slug ? { place: location.slug } : location ? { lat: location.lat, lng: location.lng } : {};
    router.push(`/equipment${toQueryString({ q: q.trim(), ...where, radiusKm: location ? radiusKm : undefined })}`);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} role="search" className="flex gap-2">
        <label htmlFor="home-q" className="sr-only">{t('search.keyword')}</label>
        <Input id="home-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('home.searchPlaceholder')} className="text-lg" />
        <Button type="submit" aria-label={t('common.search')} className="px-4"><Search className="size-6" aria-hidden /><span className="hidden sm:inline">{t('common.search')}</span></Button>
      </form>
      <LocationBar />
    </div>
  );
}
