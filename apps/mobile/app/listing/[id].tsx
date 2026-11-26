import { googleMapsUrl, areaText, REPORT_REASONS, type ContactDto, type ListingDetailDto, type ReportReason } from '@yantramitra/shared-types';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useFormatter, useLocale, useTranslations } from 'use-intl';
import { api } from '@/api';
import { Art } from '@/Art';
import { useAuth } from '@/auth';
import { useErrors } from '@/errors';
import { areaLabel, pickName, priceLabel } from '@/format';
import { colors, space } from '@/theme';
import { Banner, Button, Card, Chip, Field, H1, H2, Loading, Muted, s, Screen } from '@/ui';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const errors = useErrors();
  const { user } = useAuth();
  const [l, setL] = useState<ListingDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactDto | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [reportState, setReportState] = useState<string | null>(null);

  useEffect(() => { api.equipment.get(id).then(setL, (e) => setError(errors.api(e).message)); }, [id, errors]);
  useEffect(() => { if (user) api.users.favoriteIds().then((ids) => setSaved(ids.includes(id)), () => undefined); }, [user, id]);

  if (error) return <Screen><Banner tone="error">{error}</Banner></Screen>;
  if (!l) return <Loading />;

  const needLogin = () => router.push({ pathname: '/login', params: { next: `/listing/${id}` } });
  const reveal = async () => {
    if (!user) return needLogin();
    setBusy(true);
    setContactError(null);
    try { setContact(await api.equipment.contact(id)); } catch (e) { setContactError(errors.api(e).message); } finally { setBusy(false); }
  };
  // The call is started only by the user's own tap.
  const call = () => { void api.equipment.contactEvent(id, 'call_click').catch(() => undefined); void Linking.openURL(`tel:${contact!.phone}`); };
  const whatsapp = () => { void api.equipment.contactEvent(id, 'whatsapp_click').catch(() => undefined); void Linking.openURL(contact!.whatsappUrl!); };
  const toggleSave = async () => {
    if (!user) return needLogin();
    const next = !saved;
    setSaved(next);
    try { await (next ? api.equipment.addFavorite(id) : api.equipment.removeFavorite(id)); } catch { setSaved(!next); }
  };
  const sendReport = async () => {
    if (!reason) return;
    try { await api.equipment.report(id, { reason, details: details || null }); setReportState(t('listing.reportSent')); } catch (e) { setReportState(errors.api(e).message); }
  };
  const area = areaLabel(l.location, t('location.unknownArea'));

  return (
    <Screen>
      <Stack.Screen options={{ title: pickName(l.type.names, locale) }} />
      <View style={{ alignItems: 'center', backgroundColor: colors.leafLight, borderRadius: 16, padding: space.lg }}><Art iconKey={l.type.iconKey} fallbackKey={l.category.iconKey} height={110} /></View>
      <H1>{l.title}</H1>
      <Muted>📍 {area}</Muted>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>{priceLabel(l.pricing, t, locale)}</Text>
      {l.pricing.negotiable && l.pricing.price != null && <Muted>{t('pricing.negotiable')}</Muted>}
      {l.pricing.minHours != null && <Muted>{t('pricing.minHours', { value: l.pricing.minHours })}</Muted>}
      {l.pricing.minAcres != null && <Muted>{t('pricing.minAcres', { value: l.pricing.minAcres })}</Muted>}
      {l.status === 'unavailable' && <Banner tone="warning">{t('listing.unavailableBanner')}</Banner>}

      <Card>
        {l.status !== 'active' ? <Banner tone="warning">{t('listing.notActive')}</Banner>
          : !l.contactEnabled ? <Banner>{t('listing.contactDisabled')}</Banner>
          : !contact ? (
            <>
              <Button title={user ? t('listing.showNumber') : t('listing.contactOwner')} loading={busy} onPress={reveal} testID="show-number" />
              {!user && <Muted>{t('listing.loginToContact')}</Muted>}
              {contactError && <Banner tone="error">{contactError}</Banner>}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 24, fontWeight: '800', textAlign: 'center' }} selectable>{contact.phone}</Text>
              <Button title={t('listing.call', { name: contact.ownerName })} onPress={call} />
              {contact.whatsappUrl && <Button variant="secondary" title={t('listing.whatsapp')} onPress={whatsapp} />}
              <Muted>{t('listing.verifiedNotice')}</Muted>
            </>
          )}
        <View style={s.row}>
          <Button variant="secondary" title={saved ? `♥ ${t('listing.saved')}` : `♡ ${t('listing.save')}`} onPress={toggleSave} />
          <Button variant="ghost" title={t('listing.report')} onPress={() => (user ? setReporting((x) => !x) : needLogin())} />
        </View>
        {reporting && (
          <View style={{ gap: space.sm }}>
            <Text style={s.label}>{t('listing.reportReason')}</Text>
            <View style={s.row}>{REPORT_REASONS.map((r) => <Chip key={r} label={t(`listing.reasons.${r}`)} selected={reason === r} onPress={() => setReason(r)} />)}</View>
            <Field label={t('listing.reportDetails')} value={details} onChangeText={setDetails} multiline maxLength={1000} />
            <Button title={t('listing.reportSend')} disabled={!reason} onPress={sendReport} />
            {reportState && <Banner>{reportState}</Banner>}
          </View>
        )}
      </Card>

      {l.operations.length > 0 && (<><H2>{t('listing.operations')}</H2><View style={s.row}>{l.operations.map((o) => <Chip key={o.id} label={pickName(o.names, locale)} onPress={() => undefined} />)}</View></>)}
      <H2>{t('listing.conditions')}</H2>
      <Card>
        <Text style={{ fontSize: 16 }}>{t(`terms.operatorValues.${l.operatorTerm}`)}</Text>
        <Text style={{ fontSize: 16 }}>{t(`terms.fuelValues.${l.fuelTerm}`)}</Text>
        <Text style={{ fontSize: 16 }}>{t(`terms.transportValues.${l.transportTerm}`)}</Text>
        {l.additionalConditions && <Muted>{l.additionalConditions}</Muted>}
      </Card>
      {(l.description || l.manufacturer || l.model || l.manufacturingYear) && (
        <>
          <H2>{t('listing.details')}</H2>
          <Card>
            {l.manufacturer && <Text>{t('listing.manufacturer')}: {l.manufacturer}</Text>}
            {l.model && <Text>{t('listing.model')}: {l.model}</Text>}
            {l.manufacturingYear && <Text>{t('listing.year')}: {l.manufacturingYear}</Text>}
            {l.description && <Text style={{ fontSize: 16 }}>{l.description}</Text>}
          </Card>
        </>
      )}
      <H2>{t('listing.location')}</H2>
      <Card>
        <Text style={{ fontSize: 16 }}>{area}</Text>
        <Muted>{t('listing.updated', { time: format.dateTime(new Date(l.location.updatedAt), { dateStyle: 'medium' }) })}</Muted>
        <Muted>{t('listing.mapNote')}</Muted>
        <Button variant="secondary" title={t('listing.openMaps')} onPress={() => Linking.openURL(googleMapsUrl({ point: l.location.point, areaText: areaText(l.location) }))} />
        {l.homeArea && <Muted>{t('listing.homeArea')}: {areaText(l.homeArea)}</Muted>}
      </Card>
      <Banner>{t('listing.safety')}</Banner>
    </Screen>
  );
}
