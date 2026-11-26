import type { OwnerListingDto } from '@yantramitra/shared-types';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { api } from '@/api';
import { useErrors } from '@/errors';
import { pickName, priceLabel } from '@/format';
import { SignedIn } from '@/SignedIn';
import { colors } from '@/theme';
import { Banner, Button, Card, H1, Loading, Muted, s, Screen } from '@/ui';

function MyListings() {
  const t = useTranslations();
  const locale = useLocale();
  const errors = useErrors();
  const [items, setItems] = useState<OwnerListingDto[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => { api.users.listings({ pageSize: 50 }).then((r) => setItems(r.items), (e) => setMessage(errors.api(e).message)); }, [errors]);
  useFocusEffect(load);

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); setMessage(t('my.statusChanged')); load(); } catch (e) { setMessage(errors.api(e).message); }
  };
  const confirmDelete = (l: OwnerListingDto) =>
    Alert.alert(t('my.deleteTitle'), t('my.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void act(() => api.equipment.remove(l.id)) },
    ]);

  return (
    <Screen>
      <H1>{t('my.title')}</H1>
      <Button title={t('nav.addEquipment')} onPress={() => router.push('/add')} />
      {message && <Banner>{message}</Banner>}
      {!items && <Loading />}
      {items?.length === 0 && <Muted>{t('my.empty')}</Muted>}
      {items?.map((l) => (
        <Card key={l.id}>
          <Text style={{ fontWeight: '700', color: l.status === 'active' ? colors.leaf : l.status === 'suspended' ? colors.red : colors.turmeric }}>{t(`listing.status.${l.status}`)}</Text>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>{l.title}</Text>
          <Muted>{pickName(l.type.names, locale)} · {priceLabel(l.pricing, t, locale)}</Muted>
          <Muted>📍 {l.current.label}</Muted>
          {l.status === 'suspended' && <Banner tone="error">{t('my.suspendedNote', { reason: l.suspendedReason ?? '' })}</Banner>}
          <View style={s.row}>
            {l.status !== 'suspended' && (
              <>
                <Button title={t('my.updateLocation')} onPress={() => router.push(`/location/${l.id}`)} />
                <Button variant="secondary" title={t('common.edit')} onPress={() => router.push(`/edit/${l.id}`)} />
                {l.status !== 'active' && <Button variant="secondary" title={t('my.activate')} onPress={() => act(() => api.equipment.setStatus(l.id, 'active'))} />}
                {l.status === 'active' && <Button variant="secondary" title={t('my.markUnavailable')} onPress={() => act(() => api.equipment.setStatus(l.id, 'unavailable'))} />}
                {l.status !== 'inactive' && <Button variant="ghost" title={t('my.deactivate')} onPress={() => act(() => api.equipment.setStatus(l.id, 'inactive'))} />}
              </>
            )}
            <Button variant="ghost" title={t('common.delete')} onPress={() => confirmDelete(l)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

export default function MyTab() {
  return <SignedIn><MyListings /></SignedIn>;
}
