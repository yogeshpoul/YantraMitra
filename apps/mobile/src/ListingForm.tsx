import {
  CURRENT_VISIBILITIES, FUEL_TERMS, HOME_VISIBILITIES, OPERATOR_TERMS, PRICING_TYPES, TRANSPORT_TERMS,
  type CategoryDto, type CurrentVisibility, type HomeVisibility, type OperationDto, type OwnerListingDto,
} from '@yantramitra/shared-types';
import { listingStepSchemas, type CreateListingInput } from '@yantramitra/shared-validation';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { api } from './api';
import { Art } from './Art';
import { useErrors } from './errors';
import { pickName } from './format';
import { PlacePicker, type Picked } from './PlacePicker';
import { space } from './theme';
import { Banner, Button, Card, Chip, Field, H2, Loading, Muted, s, Toggle } from './ui';

const STEPS = ['info', 'operations', 'pricing', 'conditions', 'location', 'contact', 'review'] as const;
type Step = (typeof STEPS)[number];

interface V {
  categoryId: string; equipmentTypeId: string; title: string; manufacturer: string; model: string; year: string; description: string;
  operationIds: string[]; pricingType: string; price: string; isNegotiable: boolean; minHours: string; minAcres: string;
  fuelTerm: string; operatorTerm: string; transportTerm: string; additionalConditions: string;
  home: Picked | null; homeLabel: string; homeVisibility: HomeVisibility;
  current: Picked | null; currentLabel: string; currentVisibility: CurrentVisibility; same: boolean;
  contactEnabled: boolean; allowWhatsapp: boolean;
}
const num = (x: string) => (x.trim() ? Number(x.replace(',', '.')) : null);

function initial(l?: OwnerListingDto): V {
  if (!l) return {
    categoryId: '', equipmentTypeId: '', title: '', manufacturer: '', model: '', year: '', description: '', operationIds: [], pricingType: '', price: '',
    isNegotiable: false, minHours: '', minAcres: '', fuelTerm: '', operatorTerm: '', transportTerm: '', additionalConditions: '',
    home: null, homeLabel: '', homeVisibility: 'hidden', current: null, currentLabel: '', currentVisibility: 'approximate', same: true, contactEnabled: true, allowWhatsapp: true,
  };
  return {
    categoryId: l.category.id, equipmentTypeId: l.type.id, title: l.title, manufacturer: l.manufacturer ?? '', model: l.model ?? '', year: l.manufacturingYear?.toString() ?? '',
    description: l.description ?? '', operationIds: l.operations.map((o) => o.id), pricingType: l.pricing.type, price: l.pricing.price?.toString() ?? '',
    isNegotiable: l.pricing.negotiable, minHours: l.pricing.minHours?.toString() ?? '', minAcres: l.pricing.minAcres?.toString() ?? '',
    fuelTerm: l.fuelTerm, operatorTerm: l.operatorTerm, transportTerm: l.transportTerm, additionalConditions: l.additionalConditions ?? '',
    home: { lat: l.home.lat, lng: l.home.lng, source: 'manual', label: l.home.label, slug: null }, homeLabel: l.home.label, homeVisibility: l.home.visibility,
    current: { lat: l.current.lat, lng: l.current.lng, source: 'manual', label: l.current.label, slug: null }, currentLabel: l.current.label,
    currentVisibility: l.current.visibility, same: false, contactEnabled: l.contactEnabled, allowWhatsapp: l.allowWhatsapp,
  };
}

function payload(v: V) {
  const current = v.same ? v.home : v.current;
  return {
    info: { categoryId: v.categoryId, equipmentTypeId: v.equipmentTypeId, title: v.title, manufacturer: v.manufacturer || null, model: v.model || null, manufacturingYear: num(v.year), description: v.description || null },
    operations: { operationIds: v.operationIds },
    pricing: { pricingType: v.pricingType || undefined, price: v.pricingType === 'contact_for_price' ? null : num(v.price), isNegotiable: v.isNegotiable, minHours: num(v.minHours), minAcres: num(v.minAcres) },
    conditions: { fuelTerm: v.fuelTerm || undefined, operatorTerm: v.operatorTerm || undefined, transportTerm: v.transportTerm || undefined, additionalConditions: v.additionalConditions || null },
    location: {
      home: v.home ? { lat: v.home.lat, lng: v.home.lng, source: v.home.source, label: v.homeLabel || v.home.label, visibility: v.homeVisibility } : undefined,
      current: current ? { lat: current.lat, lng: current.lng, source: current.source, label: (v.same ? v.homeLabel : v.currentLabel) || current.label, visibility: v.currentVisibility } : undefined,
    },
    contact: { contactEnabled: v.contactEnabled, allowWhatsapp: v.allowWhatsapp },
  };
}

/** Seven-step listing form; validated with the same shared schemas as the API and website. */
export function ListingForm({ listing }: { listing?: OwnerListingDto }) {
  const t = useTranslations();
  const locale = useLocale();
  const errors = useErrors();
  const [cat, setCat] = useState<{ categories: CategoryDto[]; operations: OperationDto[] } | null>(null);
  const [v, setV] = useState<V>(() => initial(listing));
  const [step, setStep] = useState<Step>('info');
  const [err, setErr] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { Promise.all([api.catalogue.categories(), api.catalogue.operations()]).then(([categories, operations]) => setCat({ categories, operations }), () => setMessage(t('state.errorText'))); }, [t]);
  if (!cat) return message ? <Banner tone="error">{message}</Banner> : <Loading />;

  const set = <K extends keyof V>(k: K, val: V[K]) => setV((x) => ({ ...x, [k]: val }));
  const p = payload(v);
  const idx = STEPS.indexOf(step);
  const category = cat.categories.find((c) => c.id === v.categoryId);
  const type = category?.types.find((x) => x.id === v.equipmentTypeId);

  const validate = (st: Step) => {
    if (st === 'review') return true;
    const r = listingStepSchemas[st].safeParse(p[st]);
    if (r.success) { setErr({}); return true; }
    const e = errors.zod(r.error);
    if (st === 'location' && !v.home) e.home = t('form.locationRequired');
    setErr(e);
    return false;
  };
  const next = () => { if (validate(step)) setStep(STEPS[idx + 1]!); };

  const submit = async () => {
    for (const st of STEPS) if (!validate(st)) return setStep(st);
    setBusy(true);
    setMessage(null);
    try {
      if (listing) {
        await api.equipment.update(listing.id, { ...p.info, ...p.operations, ...p.pricing, ...p.conditions, home: p.location.home, ...p.contact } as never);
        router.replace('/my');
      } else {
        const created = await api.equipment.create({ ...p.info, ...p.operations, ...p.pricing, ...p.conditions, ...p.location, ...p.contact } as CreateListingInput);
        router.replace(`/listing/${created.id}`);
      }
    } catch (e) {
      const r = errors.api(e);
      setMessage(r.message);
      setErr(r.fields);
      setBusy(false);
    }
  };

  const choice = (key: 'fuelTerm' | 'operatorTerm' | 'transportTerm', label: string, opts: readonly string[], ns: string) => (
    <View style={{ gap: space.xs }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>{opts.map((o) => <Chip key={o} label={t(`terms.${ns}.${o}`)} selected={v[key] === o} onPress={() => set(key, o)} />)}</View>
      {err[key] && <Text style={s.error}>{err[key]}</Text>}
    </View>
  );

  return (
    <View style={{ gap: space.md }}>
      <Muted>{t('form.stepOf', { current: idx + 1, total: STEPS.length })} · {t(`form.steps.${step}`)}</Muted>
      {message && <Banner tone="error">{message}</Banner>}
      <Card style={{ gap: space.md }}>
        {step === 'info' && (
          <>
            <Text style={s.label}>{t('form.category')}</Text>
            <View style={s.row}>{cat.categories.map((c) => <Chip key={c.id} label={pickName(c.names, locale)} selected={v.categoryId === c.id} onPress={() => setV((x) => ({ ...x, categoryId: c.id, equipmentTypeId: '' }))} />)}</View>
            {err.categoryId && <Text style={s.error}>{err.categoryId}</Text>}
            {category && (
              <>
                <Text style={s.label}>{t('form.type')}</Text>
                <View style={s.row}>{category.types.map((ty) => <Chip key={ty.id} label={pickName(ty.names, locale)} selected={v.equipmentTypeId === ty.id} onPress={() => set('equipmentTypeId', ty.id)} />)}</View>
              </>
            )}
            {err.equipmentTypeId && <Text style={s.error}>{err.equipmentTypeId}</Text>}
            {category && <View style={{ alignItems: 'center' }}><Art iconKey={type?.iconKey} fallbackKey={category.iconKey} /></View>}
            <Muted>{t('form.noImagesNote')}</Muted>
            <Field label={t('form.title')} hint={t('form.titleHint')} value={v.title} onChangeText={(x) => set('title', x)} error={err.title} maxLength={100} />
            <Field label={t('form.manufacturer')} value={v.manufacturer} onChangeText={(x) => set('manufacturer', x)} error={err.manufacturer} />
            <Field label={t('form.model')} value={v.model} onChangeText={(x) => set('model', x)} error={err.model} />
            <Field label={t('form.year')} value={v.year} onChangeText={(x) => set('year', x)} keyboardType="number-pad" maxLength={4} error={err.manufacturingYear} />
            <Field label={t('form.description')} hint={t('form.descriptionHint')} value={v.description} onChangeText={(x) => set('description', x)} multiline error={err.description} />
          </>
        )}
        {step === 'operations' && (
          <>
            <Muted>{t('form.operationsHint')}</Muted>
            {cat.operations.map((o) => (
              <Toggle key={o.id} label={pickName(o.names, locale)} value={v.operationIds.includes(o.id)}
                onChange={(on) => set('operationIds', on ? [...v.operationIds, o.id] : v.operationIds.filter((x) => x !== o.id))} />
            ))}
            {err.operationIds && <Text style={s.error}>{err.operationIds}</Text>}
          </>
        )}
        {step === 'pricing' && (
          <>
            <Text style={s.label}>{t('form.pricingType')}</Text>
            <View style={s.row}>{PRICING_TYPES.map((pt) => <Chip key={pt} label={t(`pricing.type.${pt}`)} selected={v.pricingType === pt} onPress={() => set('pricingType', pt)} />)}</View>
            {err.pricingType && <Text style={s.error}>{err.pricingType}</Text>}
            {v.pricingType && v.pricingType !== 'contact_for_price' && (
              <>
                <Field label={t('form.price')} value={v.price} onChangeText={(x) => set('price', x)} keyboardType="decimal-pad" error={err.price} />
                <Toggle label={t('form.negotiable')} value={v.isNegotiable} onChange={(x) => set('isNegotiable', x)} />
              </>
            )}
            <Field label={t('form.minHours')} value={v.minHours} onChangeText={(x) => set('minHours', x)} keyboardType="decimal-pad" error={err.minHours} />
            <Field label={t('form.minAcres')} value={v.minAcres} onChangeText={(x) => set('minAcres', x)} keyboardType="decimal-pad" error={err.minAcres} />
          </>
        )}
        {step === 'conditions' && (
          <>
            {choice('fuelTerm', t('terms.fuel'), FUEL_TERMS, 'fuelValues')}
            {choice('operatorTerm', t('terms.operator'), OPERATOR_TERMS, 'operatorValues')}
            {choice('transportTerm', t('terms.transport'), TRANSPORT_TERMS, 'transportValues')}
            <Field label={t('form.additionalConditions')} hint={t('form.additionalHint')} value={v.additionalConditions} onChangeText={(x) => set('additionalConditions', x)} multiline />
          </>
        )}
        {step === 'location' && (
          <>
            <H2>{t('form.homeTitle')}</H2>
            <Muted>{t('form.homeHint')}</Muted>
            <PlacePicker value={v.home} onChange={(x) => set('home', x)} />
            {err.home && <Text style={s.error}>{err.home}</Text>}
            <Field label={t('form.label')} hint={t('form.labelHint')} value={v.homeLabel} onChangeText={(x) => set('homeLabel', x)} maxLength={160} />
            <Text style={s.label}>{t('form.visibility')}</Text>
            <View style={s.row}>{HOME_VISIBILITIES.map((hv) => <Chip key={hv} label={t(`form.homeVisibility.${hv}`)} selected={v.homeVisibility === hv} onPress={() => set('homeVisibility', hv)} />)}</View>
            {!listing && (
              <>
                <H2>{t('form.currentTitle')}</H2>
                <Muted>{t('form.currentHint')}</Muted>
                <Toggle label={t('form.currentSameAsHome')} value={v.same} onChange={(x) => set('same', x)} />
                {!v.same && <PlacePicker value={v.current} onChange={(x) => set('current', x)} />}
                <Text style={s.label}>{t('form.visibility')}</Text>
                <View style={s.row}>{CURRENT_VISIBILITIES.map((cv) => <Chip key={cv} label={t(`location.precision.${cv}`)} selected={v.currentVisibility === cv} onPress={() => set('currentVisibility', cv)} />)}</View>
              </>
            )}
          </>
        )}
        {step === 'contact' && (
          <>
            <Toggle label={t('form.contactEnabled')} description={t('form.contactDisabledNote')} value={v.contactEnabled} onChange={(x) => set('contactEnabled', x)} />
            {v.contactEnabled && <Toggle label={t('form.allowWhatsapp')} value={v.allowWhatsapp} onChange={(x) => set('allowWhatsapp', x)} />}
            <Banner>{t('form.phoneNotice')}</Banner>
          </>
        )}
        {step === 'review' && (
          <>
            <H2>{t('form.reviewTitle')}</H2>
            <Text style={{ fontSize: 17, fontWeight: '700' }}>{v.title}</Text>
            <Muted>{category ? pickName(category.names, locale) : ''} › {type ? pickName(type.names, locale) : ''}</Muted>
            <Muted>{v.pricingType ? t(`pricing.type.${v.pricingType}`) : ''} {v.price}</Muted>
            <Muted>{v.home?.label}</Muted>
          </>
        )}
      </Card>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {idx > 0 && <Button style={{ flex: 1 }} variant="secondary" title={t('common.back')} onPress={() => setStep(STEPS[idx - 1]!)} />}
        {step !== 'review'
          ? <Button style={{ flex: 1 }} title={t('common.next')} onPress={next} testID="form-next" />
          : <Button style={{ flex: 1 }} title={listing ? t('form.saveChanges') : t('form.publish')} loading={busy} onPress={submit} testID="form-submit" />}
      </View>
    </View>
  );
}
