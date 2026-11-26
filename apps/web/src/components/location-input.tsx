'use client';
import type { LatLng, LocationSource } from '@yantramitra/shared-types';
import { Crosshair, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { api } from '@/lib/client-api';
import { getCurrentPosition } from './location-context';
import { PlaceSearch } from './place-search';
import { Alert, Button, Skeleton } from './ui';

const MapPicker = dynamic(() => import('./map-picker'), { ssr: false, loading: () => <Skeleton className="h-72" /> });

export interface PickedLocation extends LatLng {
  source: LocationSource;
  /** Gazetteer name of the area, shown to help the owner confirm the spot */
  areaLabel?: string;
}

/** Search, GPS and map pin. Any one of the three is enough. */
export function LocationInput({ value, onChange, testId }: { value: PickedLocation | null; onChange: (v: PickedLocation) => void; testId?: string }) {
  const t = useTranslations('location');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const fromGps = async () => {
    setLocating(true);
    setError(null);
    try {
      const p = await getCurrentPosition();
      const place = await api.locations.reverse(p.lat, p.lng).catch(() => null);
      onChange({ ...p, source: 'gps', areaLabel: place?.label });
    } catch (e) {
      setError(e === 'denied' ? t('gpsDenied') : t('gpsUnavailable'));
    } finally {
      setLocating(false);
    }
  };

  const fromMap = async (p: LatLng) => {
    onChange({ ...p, source: 'map', areaLabel: value?.areaLabel });
    const place = await api.locations.reverse(p.lat, p.lng).catch(() => null);
    onChange({ ...p, source: 'map', areaLabel: place?.label });
  };

  return (
    <div className="space-y-3" data-testid={testId}>
      <PlaceSearch onSelect={(p) => onChange({ lat: p.lat, lng: p.lng, source: 'search', areaLabel: p.label })} />
      <Button variant="secondary" onClick={fromGps} loading={locating} className="min-h-10">
        {!locating && <Crosshair className="size-5" aria-hidden />}{locating ? t('locating') : t('useGps')}
      </Button>
      {error && <Alert tone="warning">{error}</Alert>}
      {mapFailed ? <Alert tone="info">{t('mapUnavailable')}</Alert> : (
        <div className="space-y-1">
          <p className="text-sm text-muted">{t('pickOnMap')}</p>
          <MapPicker value={value} onChange={fromMap} onError={() => setMapFailed(true)} />
        </div>
      )}
      {value && (
        <p className="flex items-start gap-2 rounded-xl bg-leaf-50 p-3 text-sm" data-testid="picked-location">
          <MapPin className="mt-0.5 size-4 shrink-0 text-leaf-700" aria-hidden />
          <span>
            {value.areaLabel && <span className="block font-semibold">{t('selected', { label: value.areaLabel })}</span>}
            <span className="text-muted">{t('coordinates', { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) })}</span>
          </span>
        </p>
      )}
    </div>
  );
}
