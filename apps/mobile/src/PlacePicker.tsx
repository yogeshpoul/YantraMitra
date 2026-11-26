import type { LatLng, LocationSource, PlaceDto } from '@yantramitra/shared-types';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { api } from './api';
import { currentPosition } from './location';
import { MapPicker } from './MapPicker';
import { colors, space } from './theme';
import { Banner, Button, Field, s } from './ui';

export interface Picked extends LatLng {
  source: LocationSource;
  label: string;
  slug: string | null;
}

export function PlaceSearch({ onSelect }: { onSelect: (p: PlaceDto) => void }) {
  const t = useTranslations('location');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); return; }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      api.locations.search(query, 8).then((r) => id === seq.current && setResults(r), () => undefined).finally(() => id === seq.current && setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <View style={{ gap: space.xs }}>
      <Field label={t('label')} placeholder={t('searchPlaceholder')} value={q} onChangeText={setQ} autoCorrect={false} />
      {loading && <ActivityIndicator color={colors.leaf} />}
      {q.trim().length >= 2 && !loading && results.length === 0 && <Text style={s.hint}>{t('noResults')}</Text>}
      {results.map((p, i) => (
        <Pressable key={`${p.slug ?? p.label}-${i}`} accessibilityRole="button" onPress={() => { onSelect(p); setQ(''); setResults([]); }}
          style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.soilBorder }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>{p.kind === 'postal' ? `${p.postalCode} · ${p.name}` : p.name}{['taluka', 'district', 'state'].includes(p.kind) ? ` (${t(`kind.${p.kind}`)})` : ''}</Text>
          <Text style={s.hint}>{[p.taluka, p.district, p.state].filter(Boolean).join(', ')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Search, GPS or map pin — any one is enough. Works with location permission denied. */
export function PlacePicker({ value, onChange, withMap = true }: { value: Picked | null; onChange: (p: Picked) => void; withMap?: boolean }) {
  const t = useTranslations('location');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gps = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await currentPosition();
      const place = await api.locations.reverse(p.lat, p.lng).catch(() => null);
      onChange({ ...p, source: 'gps', label: place?.label ?? t('nearYou'), slug: null });
    } catch (e) {
      setError(e instanceof Error && e.message === 'denied' ? t('gpsDenied') : t('gpsUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <PlaceSearch onSelect={(p) => onChange({ lat: p.lat, lng: p.lng, source: 'search', label: p.label, slug: p.slug })} />
      <Button variant="secondary" title={busy ? t('locating') : t('useGps')} loading={busy} onPress={gps} />
      {error && <Banner tone="warning">{error}</Banner>}
      {withMap && (
        <>
          <Text style={s.hint}>{t('pickOnMap')}</Text>
          <MapPicker value={value} onChange={async (p) => {
            onChange({ ...p, source: 'map', label: value?.label ?? '', slug: null });
            const place = await api.locations.reverse(p.lat, p.lng).catch(() => null);
            onChange({ ...p, source: 'map', label: place?.label ?? `${p.lat}, ${p.lng}`, slug: null });
          }} />
        </>
      )}
      {value && <Banner tone="success">{t('selected', { label: value.label || `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}` })}</Banner>}
    </View>
  );
}
