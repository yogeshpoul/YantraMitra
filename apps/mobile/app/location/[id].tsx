import type { LocationHistoryDto, OwnerListingDto } from '@yantramitra/shared-types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { api } from '@/api';
import { useErrors } from '@/errors';
import { PlacePicker, type Picked } from '@/PlacePicker';
import { SignedIn } from '@/SignedIn';
import { Banner, Button, Card, Field, H2, Loading, Muted, Screen } from '@/ui';

/** The owner moves the current location by hand; home stays unchanged. No background tracking. */
function UpdateLocation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const format = useFormatter();
  const errors = useErrors();
  const [listing, setListing] = useState<OwnerListingDto | null>(null);
  const [history, setHistory] = useState<LocationHistoryDto[]>([]);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.users.listing(id).then(setListing, (e) => setMessage({ tone: 'error', text: errors.api(e).message }));
    api.users.locationHistory(id).then(setHistory, () => undefined);
  }, [id, errors]);
  useEffect(load, [load]);

  if (!listing) return message ? <Screen><Banner tone="error">{message.text}</Banner></Screen> : <Loading />;

  const save = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await api.equipment.updateLocation(id, { lat: picked.lat, lng: picked.lng, source: picked.source, label: label.trim() || picked.label || listing.current.label });
      setMessage({ tone: 'success', text: t('my.locationSaved') });
      setPicked(null);
      setLabel('');
      load();
    } catch (e) {
      setMessage({ tone: 'error', text: errors.api(e).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Muted>{t('my.locationText', { title: listing.title })}</Muted>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
      <Card>
        <Muted>{t('form.currentTitle')}</Muted>
        <Text style={{ fontSize: 17, fontWeight: '700' }}>{listing.current.label}</Text>
      </Card>
      <PlacePicker value={picked} onChange={setPicked} />
      <Field label={t('form.label')} hint={t('form.labelHint')} value={label} onChangeText={setLabel} maxLength={160} />
      <Button title={t('common.save')} disabled={!picked} loading={busy} onPress={save} />
      {history.length > 0 && (
        <>
          <H2>{t('my.history')}</H2>
          {history.map((h) => <Muted key={h.id}>{format.dateTime(new Date(h.createdAt), { dateStyle: 'medium', timeStyle: 'short' })} · {h.label}</Muted>)}
        </>
      )}
    </Screen>
  );
}

export default function LocationScreen() {
  return <SignedIn><UpdateLocation /></SignedIn>;
}
