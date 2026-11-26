'use client';
import { RADIUS_PRESETS_KM } from '@yantramitra/shared-types';
import { Crosshair, Loader2, MapPin, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/client-api';
import { getCurrentPosition, useSearchLocation, type GeoError, type SearchLocation } from './location-context';
import { PlaceSearch } from './place-search';
import { Alert, Button, cx } from './ui';

/**
 * Location chooser. GPS is optional; when permission is denied the visitor simply searches
 * for a place, so browsing never depends on location permission.
 */
export function LocationBar({ onChange, showRadius = true, className }: {
  onChange?: (l: SearchLocation | null, radiusKm: number) => void; showRadius?: boolean; className?: string;
}) {
  const t = useTranslations('location');
  const tc = useTranslations('common');
  const { location, radiusKm, setLocation, setRadiusKm } = useSearchLocation();
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<GeoError | null>(null);

  const apply = (l: SearchLocation | null, r = radiusKm) => { setLocation(l); setEditing(false); onChange?.(l, r); };

  const useGps = async () => {
    setLocating(true);
    setGeoError(null);
    try {
      const p = await getCurrentPosition();
      const place = await api.locations.reverse(p.lat, p.lng).catch(() => null);
      apply({ source: 'gps', lat: p.lat, lng: p.lng, slug: null, label: place?.label ?? t('nearYou') });
    } catch (e) {
      setGeoError(e === 'denied' ? 'denied' : 'unavailable');
      setEditing(true);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className={cx('space-y-3 rounded-2xl border border-soil-200 bg-white p-4', className)}>
      {!editing && (
        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="size-6 shrink-0 text-leaf-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted">{t('label')}</div>
            <div className="truncate font-semibold" data-testid="location-label">{location?.label ?? t('anywhere')}</div>
          </div>
          <Button variant="secondary" className="min-h-10" onClick={() => setEditing(true)}>{t('change')}</Button>
          {location && <Button variant="ghost" className="min-h-10 px-3" aria-label={tc('clear')} onClick={() => apply(null)}><X className="size-5" /></Button>}
        </div>
      )}
      {editing && (
        <div className="space-y-3">
          <PlaceSearch autoFocus onSelect={(p) => apply({ source: 'place', label: p.label, lat: p.lat, lng: p.lng, slug: p.slug })} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={useGps} loading={locating} className="min-h-10">
              {!locating && <Crosshair className="size-5" aria-hidden />}{locating ? t('locating') : t('useGps')}
            </Button>
            <Button variant="ghost" className="min-h-10" onClick={() => setEditing(false)}>{tc('cancel')}</Button>
          </div>
          {geoError && <Alert tone="warning">{geoError === 'denied' ? t('gpsDenied') : t('gpsUnavailable')}</Alert>}
        </div>
      )}
      {showRadius && location && !editing && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('radius')}>
          <span className="text-sm font-medium text-muted">{t('radius')}</span>
          {RADIUS_PRESETS_KM.map((km) => (
            <button key={km} type="button" aria-pressed={radiusKm === km} onClick={() => { setRadiusKm(km); onChange?.(location, km); }}
              className={cx('min-h-10 rounded-full border px-4 font-medium', radiusKm === km ? 'border-leaf-600 bg-leaf-600 text-white' : 'border-soil-200 bg-white hover:bg-leaf-50')}>
              {tc('km', { value: km })}
            </button>
          ))}
          {locating && <Loader2 className="size-5 animate-spin" />}
        </div>
      )}
    </div>
  );
}
