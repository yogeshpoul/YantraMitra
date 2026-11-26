'use client';
import {
  CURRENT_VISIBILITIES, FUEL_TERMS, HOME_VISIBILITIES, OPERATOR_TERMS, PRICING_TYPES, TRANSPORT_TERMS,
  type CategoryDto, type CurrentVisibility, type HomeVisibility, type OperationDto, type OwnerListingDto, type PricingType,
} from '@yantramitra/shared-types';
import { fieldErrors, listingStepSchemas, LIMITS, type CreateListingInput } from '@yantramitra/shared-validation';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useErrorText, useFieldText } from '@/lib/errors';
import { formatMoney, pickName } from '@/lib/format';
import { EquipmentArt } from './equipment-art';
import { LocationInput, type PickedLocation } from './location-input';
import { Alert, Button, Card, Checkbox, cx, Field, Input, Select, Skeleton, Textarea } from './ui';

const STEPS = ['info', 'operations', 'pricing', 'conditions', 'location', 'contact', 'review'] as const;
type Step = (typeof STEPS)[number];

interface Values {
  categoryId: string; equipmentTypeId: string; title: string; manufacturer: string; model: string; manufacturingYear: string; description: string;
  operationIds: string[];
  pricingType: PricingType | ''; price: string; isNegotiable: boolean; minHours: string; minAcres: string;
  fuelTerm: string; operatorTerm: string; transportTerm: string; additionalConditions: string;
  home: PickedLocation | null; homeLabel: string; homeVisibility: HomeVisibility;
  current: PickedLocation | null; currentLabel: string; currentVisibility: CurrentVisibility; currentSameAsHome: boolean;
  contactEnabled: boolean; allowWhatsapp: boolean;
}

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

function fromListing(l: OwnerListingDto): Values {
  return {
    categoryId: l.category.id, equipmentTypeId: l.type.id, title: l.title, manufacturer: l.manufacturer ?? '', model: l.model ?? '',
    manufacturingYear: l.manufacturingYear?.toString() ?? '', description: l.description ?? '', operationIds: l.operations.map((o) => o.id),
    pricingType: l.pricing.type, price: l.pricing.price?.toString() ?? '', isNegotiable: l.pricing.negotiable,
    minHours: l.pricing.minHours?.toString() ?? '', minAcres: l.pricing.minAcres?.toString() ?? '',
    fuelTerm: l.fuelTerm, operatorTerm: l.operatorTerm, transportTerm: l.transportTerm, additionalConditions: l.additionalConditions ?? '',
    home: { lat: l.home.lat, lng: l.home.lng, source: 'manual' }, homeLabel: l.home.label, homeVisibility: l.home.visibility,
    current: { lat: l.current.lat, lng: l.current.lng, source: 'manual' }, currentLabel: l.current.label, currentVisibility: l.current.visibility,
    currentSameAsHome: false, contactEnabled: l.contactEnabled, allowWhatsapp: l.allowWhatsapp,
  };
}

const EMPTY: Values = {
  categoryId: '', equipmentTypeId: '', title: '', manufacturer: '', model: '', manufacturingYear: '', description: '', operationIds: [],
  pricingType: '', price: '', isNegotiable: false, minHours: '', minAcres: '', fuelTerm: '', operatorTerm: '', transportTerm: '', additionalConditions: '',
  home: null, homeLabel: '', homeVisibility: 'hidden', current: null, currentLabel: '', currentVisibility: 'approximate', currentSameAsHome: true,
  contactEnabled: true, allowWhatsapp: true,
};

/** Shapes the form into the API payload; the same shared Zod schemas validate it here and on the server. */
function toPayload(v: Values) {
  const current = v.currentSameAsHome ? v.home : v.current;
  return {
    info: {
      categoryId: v.categoryId, equipmentTypeId: v.equipmentTypeId, title: v.title, manufacturer: v.manufacturer || null, model: v.model || null,
      manufacturingYear: num(v.manufacturingYear), description: v.description || null,
    },
    operations: { operationIds: v.operationIds },
    pricing: {
      pricingType: v.pricingType || undefined, price: v.pricingType === 'contact_for_price' ? null : num(v.price),
      isNegotiable: v.isNegotiable, minHours: num(v.minHours), minAcres: num(v.minAcres),
    },
    conditions: { fuelTerm: v.fuelTerm || undefined, operatorTerm: v.operatorTerm || undefined, transportTerm: v.transportTerm || undefined, additionalConditions: v.additionalConditions || null },
    location: {
      home: v.home ? { lat: v.home.lat, lng: v.home.lng, source: v.home.source, label: v.homeLabel || v.home.areaLabel || '', visibility: v.homeVisibility } : undefined,
      current: current ? { lat: current.lat, lng: current.lng, source: current.source, label: (v.currentSameAsHome ? v.homeLabel : v.currentLabel) || current.areaLabel || '', visibility: v.currentVisibility } : undefined,
    },
    contact: { contactEnabled: v.contactEnabled, allowWhatsapp: v.allowWhatsapp },
  };
}

export function ListingWizard({ listing }: { listing?: OwnerListingDto }) {
  const t = useTranslations();
  const tf = useTranslations('form');
  const locale = useLocale();
  const router = useRouter();
  const errorText = useErrorText();
  const tv = useFieldText();
  const editing = Boolean(listing);
  const [catalogue, setCatalogue] = useState<{ categories: CategoryDto[]; operations: OperationDto[] } | null>(null);
  const [v, setV] = useState<Values>(() => (listing ? fromListing(listing) : EMPTY));
  const [step, setStep] = useState<Step>('info');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.catalogue.categories(), api.catalogue.operations()]).then(([categories, operations]) => setCatalogue({ categories, operations }), () => setMessage(t('state.errorText')));
  }, [t]);

  const category = catalogue?.categories.find((c) => c.id === v.categoryId);
  const type = category?.types.find((ty) => ty.id === v.equipmentTypeId);
  const payload = useMemo(() => toPayload(v), [v]);
  const index = STEPS.indexOf(step);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((s) => ({ ...s, [key]: value }));
  const text = (key: keyof Values) => ({ value: v[key] as string, onChange: (e: { target: { value: string } }) => set(key, e.target.value as never) });

  const validate = (s: Step): boolean => {
    if (s === 'review') return true;
    const result = listingStepSchemas[s].safeParse(payload[s]);
    if (result.success) { setErrors({}); return true; }
    const errs = tv(fieldErrors(result.error));
    if (s === 'location') {
      if (!v.home) errs['home'] = tf('locationRequired');
      if (!v.currentSameAsHome && !v.current) errs['current'] = tf('locationRequired');
    }
    setErrors(errs);
    return false;
  };

  const go = (target: Step) => {
    if (STEPS.indexOf(target) > index && !validate(step)) return;
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    for (const s of STEPS) if (!validate(s)) return setStep(s);
    setBusy(true);
    setMessage(null);
    try {
      if (listing) {
        const { current: _ignored, ...location } = payload.location;
        await api.equipment.update(listing.id, { ...payload.info, ...payload.operations, ...payload.pricing, ...payload.conditions, ...location, ...payload.contact } as never);
        router.push(`/my-listings?updated=${listing.id}`);
      } else {
        const created = await api.equipment.create({ ...payload.info, ...payload.operations, ...payload.pricing, ...payload.conditions, ...payload.location, ...payload.contact } as CreateListingInput);
        router.push(`${created.path}?created=1`);
      }
    } catch (e) {
      const r = errorText(e);
      setMessage(r.message);
      setErrors(r.fields);
      setBusy(false);
    }
  };

  if (!catalogue) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6" data-testid="listing-wizard">
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label={tf('stepOf', { current: index + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <li key={s} className="min-w-0 flex-1">
            <button type="button" onClick={() => go(s)} aria-current={s === step ? 'step' : undefined}
              className={cx('w-full border-t-4 pt-1.5 text-left text-xs font-semibold sm:text-sm', i < index ? 'border-leaf-500 text-leaf-700' : i === index ? 'border-turmeric-500 text-ink' : 'border-soil-200 text-muted')}>
              {i + 1}. {tf(`steps.${s}`)}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">{tf('stepOf', { current: index + 1, total: STEPS.length })}</p>
      {message && <Alert tone="error">{message}</Alert>}

      <Card className="space-y-5">
        <h2 className="text-2xl font-semibold">{tf(`steps.${step}`)}</h2>

        {step === 'info' && (
          <>
            <Field label={tf('category')} error={errors.categoryId}>{(p) => (
              <Select {...p} value={v.categoryId} onChange={(e) => setV((s) => ({ ...s, categoryId: e.target.value, equipmentTypeId: '' }))} data-testid="wizard-category">
                <option value="">{tf('chooseCategory')}</option>
                {catalogue.categories.map((c) => <option key={c.id} value={c.id}>{pickName(c.names, locale)}</option>)}
              </Select>)}
            </Field>
            <Field label={tf('type')} error={errors.equipmentTypeId}>{(p) => (
              <Select {...p} {...text('equipmentTypeId')} disabled={!category} data-testid="wizard-type">
                <option value="">{tf('chooseType')}</option>
                {category?.types.map((ty) => <option key={ty.id} value={ty.id}>{pickName(ty.names, locale)}</option>)}
              </Select>)}
            </Field>
            {(type || category) && <div className="flex justify-center rounded-xl bg-leaf-50 p-3"><EquipmentArt iconKey={type?.iconKey} fallbackKey={category?.iconKey} className="h-24" /></div>}
            <p className="text-sm text-muted">{tf('noImagesNote')}</p>
            <Field label={tf('title')} hint={tf('titleHint')} error={errors.title}>{(p) => <Input {...p} {...text('title')} maxLength={LIMITS.titleMax} />}</Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tf('manufacturer')} optional={t('common.optional')} error={errors.manufacturer}>{(p) => <Input {...p} {...text('manufacturer')} maxLength={LIMITS.makerMax} />}</Field>
              <Field label={tf('model')} optional={t('common.optional')} error={errors.model}>{(p) => <Input {...p} {...text('model')} maxLength={LIMITS.makerMax} />}</Field>
              <Field label={tf('year')} optional={t('common.optional')} error={errors.manufacturingYear}>{(p) => <Input {...p} {...text('manufacturingYear')} inputMode="numeric" maxLength={4} />}</Field>
            </div>
            <Field label={tf('description')} hint={tf('descriptionHint')} optional={t('common.optional')} error={errors.description}>{(p) => <Textarea {...p} {...text('description')} maxLength={LIMITS.descriptionMax} />}</Field>
          </>
        )}

        {step === 'operations' && (
          <fieldset className="space-y-3">
            <legend className="text-muted">{tf('operationsHint')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {catalogue.operations.map((o) => (
                <Checkbox key={o.id} label={pickName(o.names, locale)} checked={v.operationIds.includes(o.id)}
                  onChange={(e) => set('operationIds', e.target.checked ? [...v.operationIds, o.id] : v.operationIds.filter((id) => id !== o.id))} />
              ))}
            </div>
            {errors.operationIds && <p className="font-medium text-red-700" role="alert">{errors.operationIds}</p>}
          </fieldset>
        )}

        {step === 'pricing' && (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 font-semibold">{tf('pricingType')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRICING_TYPES.map((pt) => (
                  <label key={pt} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-soil-200 bg-white p-3 has-[:checked]:border-leaf-500 has-[:checked]:bg-leaf-50">
                    <input type="radio" name="pricingType" value={pt} checked={v.pricingType === pt} onChange={() => set('pricingType', pt)} className="size-5 accent-leaf-600" />
                    {t(`pricing.type.${pt}`)}
                  </label>
                ))}
              </div>
              {errors.pricingType && <p className="font-medium text-red-700" role="alert">{errors.pricingType}</p>}
            </fieldset>
            {v.pricingType && v.pricingType !== 'contact_for_price' && (
              <>
                <Field label={tf('price')} error={errors.price}>{(p) => <Input {...p} {...text('price')} inputMode="decimal" data-testid="wizard-price" />}</Field>
                <Checkbox label={tf('negotiable')} checked={v.isNegotiable} onChange={(e) => set('isNegotiable', e.target.checked)} />
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tf('minHours')} optional={t('common.optional')} error={errors.minHours}>{(p) => <Input {...p} {...text('minHours')} inputMode="decimal" />}</Field>
              <Field label={tf('minAcres')} optional={t('common.optional')} error={errors.minAcres}>{(p) => <Input {...p} {...text('minAcres')} inputMode="decimal" />}</Field>
            </div>
          </>
        )}

        {step === 'conditions' && (
          <>
            {([['fuelTerm', 'fuel', FUEL_TERMS, 'fuelValues'], ['operatorTerm', 'operator', OPERATOR_TERMS, 'operatorValues'], ['transportTerm', 'transport', TRANSPORT_TERMS, 'transportValues']] as const).map(([key, label, options, values]) => (
              <Field key={key} label={t(`terms.${label}`)} error={errors[key]}>{(p) => (
                <Select {...p} {...text(key)} data-testid={`wizard-${key}`}>
                  <option value="">—</option>
                  {options.map((o) => <option key={o} value={o}>{t(`terms.${values}.${o}`)}</option>)}
                </Select>)}
              </Field>
            ))}
            <Field label={tf('additionalConditions')} hint={tf('additionalHint')} optional={t('common.optional')} error={errors.additionalConditions}>
              {(p) => <Textarea {...p} {...text('additionalConditions')} maxLength={LIMITS.conditionsMax} />}
            </Field>
          </>
        )}

        {step === 'location' && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-xl font-semibold">{tf('homeTitle')}</h3>
              <p className="text-muted">{tf('homeHint')}</p>
              <LocationInput testId="home-location" value={v.home} onChange={(p) => set('home', p)} />
              {(errors.home || errors['home.lat']) && <p className="font-medium text-red-700" role="alert">{errors.home ?? errors['home.lat']}</p>}
              <Field label={tf('label')} hint={tf('labelHint')} error={errors['home.label']}>{(p) => <Input {...p} {...text('homeLabel')} maxLength={LIMITS.labelMax} />}</Field>
              <fieldset className="space-y-2">
                <legend className="font-semibold">{tf('visibility')}</legend>
                {HOME_VISIBILITIES.map((hv) => (
                  <label key={hv} className="flex items-center gap-3"><input type="radio" name="homeVisibility" checked={v.homeVisibility === hv} onChange={() => set('homeVisibility', hv)} className="size-5 accent-leaf-600" />{tf(`homeVisibility.${hv}`)}</label>
                ))}
              </fieldset>
            </section>
            {!editing && (
              <section className="space-y-3 border-t border-soil-200 pt-5">
                <h3 className="text-xl font-semibold">{tf('currentTitle')}</h3>
                <p className="text-muted">{tf('currentHint')}</p>
                <Checkbox label={tf('currentSameAsHome')} checked={v.currentSameAsHome} onChange={(e) => set('currentSameAsHome', e.target.checked)} data-testid="same-as-home" />
                {!v.currentSameAsHome && (
                  <>
                    <LocationInput testId="current-location" value={v.current} onChange={(p) => set('current', p)} />
                    {errors.current && <p className="font-medium text-red-700" role="alert">{errors.current}</p>}
                    <Field label={tf('label')} hint={tf('labelHint')} error={errors['current.label']}>{(p) => <Input {...p} {...text('currentLabel')} maxLength={LIMITS.labelMax} />}</Field>
                  </>
                )}
                <fieldset className="space-y-2">
                  <legend className="font-semibold">{tf('visibility')}</legend>
                  {CURRENT_VISIBILITIES.map((cv) => (
                    <label key={cv} className="flex items-center gap-3"><input type="radio" name="currentVisibility" checked={v.currentVisibility === cv} onChange={() => set('currentVisibility', cv)} className="size-5 accent-leaf-600" />{t(`location.precision.${cv}`)}</label>
                  ))}
                </fieldset>
              </section>
            )}
            {editing && listing && (
              <Alert tone="info"><Link href={`/listings/${listing.id}/location`} className="font-semibold underline">{t('my.updateLocation')}</Link></Alert>
            )}
          </div>
        )}

        {step === 'contact' && (
          <div className="space-y-3">
            <Checkbox label={tf('contactEnabled')} description={tf('contactDisabledNote')} checked={v.contactEnabled} onChange={(e) => set('contactEnabled', e.target.checked)} />
            {v.contactEnabled && <Checkbox label={tf('allowWhatsapp')} checked={v.allowWhatsapp} onChange={(e) => set('allowWhatsapp', e.target.checked)} />}
            <Alert tone="info">{tf('phoneNotice')}</Alert>
          </div>
        )}

        {step === 'review' && (
          <dl className="divide-y divide-soil-100" data-testid="wizard-review">
            {[
              [tf('category'), category ? `${pickName(category.names, locale)} › ${type ? pickName(type.names, locale) : ''}` : ''],
              [tf('title'), v.title],
              [t('listing.operations'), catalogue.operations.filter((o) => v.operationIds.includes(o.id)).map((o) => pickName(o.names, locale)).join(', ')],
              [tf('pricingType'), v.pricingType ? `${t(`pricing.type.${v.pricingType}`)}${num(v.price) ? ` · ${formatMoney(num(v.price)!, 'INR', locale)}` : ''}` : ''],
              [t('terms.operator'), v.operatorTerm ? t(`terms.operatorValues.${v.operatorTerm}`) : ''],
              [t('terms.fuel'), v.fuelTerm ? t(`terms.fuelValues.${v.fuelTerm}`) : ''],
              [t('terms.transport'), v.transportTerm ? t(`terms.transportValues.${v.transportTerm}`) : ''],
              [tf('homeTitle'), v.home?.areaLabel ?? v.homeLabel],
              ...(!editing ? [[tf('currentTitle'), v.currentSameAsHome ? tf('currentSameAsHome') : (v.current?.areaLabel ?? v.currentLabel)]] : []),
              [tf('contactEnabled'), v.contactEnabled ? t('common.yes') : t('common.no')],
            ].map(([k, val]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-3"><dt className="text-muted">{k}</dt><dd className="font-medium sm:col-span-2">{val || '—'}</dd></div>
            ))}
          </dl>
        )}
      </Card>

      <div className="flex justify-between gap-3">
        {index > 0 ? <Button variant="secondary" onClick={() => go(STEPS[index - 1]!)}><ChevronLeft className="size-5" />{t('common.back')}</Button> : <span />}
        {step !== 'review'
          ? <Button onClick={() => go(STEPS[index + 1]!)} data-testid="wizard-next">{t('common.next')}<ChevronRight className="size-5" /></Button>
          : <Button onClick={submit} loading={busy} data-testid="wizard-submit"><Check className="size-5" />{editing ? tf('saveChanges') : tf('publish')}</Button>}
      </div>
    </div>
  );
}
