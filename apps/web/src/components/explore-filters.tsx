'use client';
import { OPERATOR_TERMS, PRICING_TYPES, SORT_OPTIONS, type CategoryDto, type OperationDto } from '@yantramitra/shared-types';
import type { SearchData } from '@yantramitra/shared-validation';
import { SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { pickName } from '@/lib/format';
import { toQueryString } from '@/lib/search-params';
import { LocationBar } from './location-bar';
import { useSearchLocation, type SearchLocation } from './location-context';
import { Button, Field, Input, Select } from './ui';

type Values = Partial<Record<keyof SearchData, string>>;

export function ExploreFilters({ query, categories, operations, urlLocation }: {
  query: SearchData; categories: CategoryDto[]; operations: OperationDto[]; urlLocation: SearchLocation | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { location, ready, setLocation, setRadiusKm } = useSearchLocation();
  const [open, setOpen] = useState(false);
  const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  const [v, setV] = useState<Values>({
    q: str(query.q), category: str(query.category), type: str(query.type), operation: str(query.operation),
    pricingType: str(query.pricingType), priceMin: str(query.priceMin), priceMax: str(query.priceMax),
    operatorTerm: str(query.operatorTerm), sort: str(query.sort),
  });
  const synced = useRef(false);

  const locationParams = (l: SearchLocation | null, radiusKm?: number) =>
    l ? { ...(l.slug ? { place: l.slug } : { lat: l.lat, lng: l.lng }), radiusKm: radiusKm ?? query.radiusKm } : {};
  const go = (values: Values, loc: Record<string, unknown>) => router.push(`/equipment${toQueryString({ ...values, ...loc })}`);

  // Keep the remembered location and the URL in agreement, the URL taking precedence.
  useEffect(() => {
    if (!ready || synced.current) return;
    synced.current = true;
    if (urlLocation) {
      if (!location || location.lat !== urlLocation.lat || location.lng !== urlLocation.lng) setLocation(urlLocation);
      if (query.radiusKm) setRadiusKm(query.radiusKm);
    } else if (location) {
      router.replace(`/equipment${toQueryString({ ...v, ...locationParams(location, undefined) })}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once after storage is read
  }, [ready]);

  const types = categories.find((c) => c.slug === v.category)?.types ?? categories.flatMap((c) => c.types);
  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [key]: e.target.value }));
  const submit = (e: React.FormEvent) => { e.preventDefault(); setOpen(false); go(v, locationParams(location)); };

  return (
    <div className="space-y-3">
      <LocationBar onChange={(l, r) => go(v, locationParams(l, r))} />
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-soil-200 bg-white p-4" role="search">
        <div className="flex gap-2">
          <label htmlFor="explore-q" className="sr-only">{t('search.keyword')}</label>
          <Input id="explore-q" value={v.q} onChange={set('q')} placeholder={t('home.searchPlaceholder')} />
          <Button type="submit">{t('common.search')}</Button>
        </div>
        <Button variant="ghost" className="min-h-10 px-2 lg:hidden" aria-expanded={open} aria-controls="filter-panel" onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal className="size-5" aria-hidden />{t('search.filters')}
        </Button>
        <div id="filter-panel" className={`${open ? 'grid' : 'hidden'} gap-3 sm:grid-cols-2 lg:grid`}>
          <Field label={t('search.category')}>{(p) => (
            <Select {...p} value={v.category} onChange={(e) => setV((s) => ({ ...s, category: e.target.value, type: '' }))} data-testid="filter-category">
              <option value="">{t('search.allCategories')}</option>
              {categories.map((c) => <option key={c.id} value={c.slug}>{pickName(c.names, locale)}</option>)}
            </Select>)}
          </Field>
          <Field label={t('search.type')}>{(p) => (
            <Select {...p} value={v.type} onChange={set('type')}>
              <option value="">{t('search.allTypes')}</option>
              {types.map((ty) => <option key={ty.id} value={ty.slug}>{pickName(ty.names, locale)}</option>)}
            </Select>)}
          </Field>
          <Field label={t('search.operation')}>{(p) => (
            <Select {...p} value={v.operation} onChange={set('operation')} data-testid="filter-operation">
              <option value="">{t('search.allOperations')}</option>
              {operations.map((o) => <option key={o.id} value={o.slug}>{pickName(o.names, locale)}</option>)}
            </Select>)}
          </Field>
          <Field label={t('search.pricingUnit')}>{(p) => (
            <Select {...p} value={v.pricingType} onChange={set('pricingType')}>
              <option value="">{t('search.anyUnit')}</option>
              {PRICING_TYPES.map((pt) => <option key={pt} value={pt}>{t(`pricing.type.${pt}`)}</option>)}
            </Select>)}
          </Field>
          <Field label={t('search.priceMin')}>{(p) => <Input {...p} type="number" inputMode="numeric" min={0} value={v.priceMin} onChange={set('priceMin')} />}</Field>
          <Field label={t('search.priceMax')}>{(p) => <Input {...p} type="number" inputMode="numeric" min={0} value={v.priceMax} onChange={set('priceMax')} />}</Field>
          <Field label={t('search.operator')}>{(p) => (
            <Select {...p} value={v.operatorTerm} onChange={set('operatorTerm')}>
              <option value="">{t('search.anyOperator')}</option>
              {OPERATOR_TERMS.map((o) => <option key={o} value={o}>{t(`terms.operatorValues.${o}`)}</option>)}
            </Select>)}
          </Field>
          <Field label={t('search.sort')}>{(p) => (
            <Select {...p} value={v.sort} onChange={set('sort')} data-testid="filter-sort">
              <option value="">—</option>
              {SORT_OPTIONS.filter((s) => s !== 'nearest' || location).map((s) => <option key={s} value={s}>{t(`search.sortOptions.${s}`)}</option>)}
            </Select>)}
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" className="flex-1">{t('search.apply')}</Button>
            <Button variant="secondary" onClick={() => { const empty = {}; setV(empty); go(empty, locationParams(location)); }}>{t('search.reset')}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
