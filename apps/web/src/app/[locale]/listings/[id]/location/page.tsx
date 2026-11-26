'use client';
import { CURRENT_VISIBILITIES, type CurrentVisibility, type LocationHistoryDto } from '@yantramitra/shared-types';
import { LIMITS } from '@yantramitra/shared-validation';
import { useFormatter, useTranslations } from 'next-intl';
import { use, useEffect, useState } from 'react';
import { LocationInput, type PickedLocation } from '@/components/location-input';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Button, Card, Field, Input, Skeleton } from '@/components/ui';
import { useOwnListing } from '@/components/use-own-listing';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useErrorText } from '@/lib/errors';

/** Manual update of where the machine is now. Home location is untouched; no background tracking. */
function UpdateLocation({ id }: { id: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const errorText = useErrorText();
  const { listing, setListing, error } = useOwnListing(id);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [label, setLabel] = useState('');
  const [visibility, setVisibility] = useState<CurrentVisibility | null>(null);
  const [history, setHistory] = useState<LocationHistoryDto[]>([]);
  const [state, setState] = useState<{ busy?: boolean; ok?: boolean; error?: string }>({});

  useEffect(() => { api.users.locationHistory(id).then(setHistory, () => undefined); }, [id, state.ok]);

  if (error) return <div className="container-page py-8"><Alert tone="error">{error}</Alert></div>;
  if (!listing) return <div className="container-page py-8"><Skeleton className="h-96" /></div>;

  const save = async () => {
    if (!picked) return setState({ error: t('form.locationRequired') });
    setState({ busy: true });
    try {
      const updated = await api.equipment.updateLocation(id, {
        lat: picked.lat, lng: picked.lng, source: picked.source, label: label.trim() || picked.areaLabel || listing.current.label,
        visibility: visibility ?? undefined,
      });
      setListing(updated);
      setPicked(null);
      setLabel('');
      setState({ ok: true });
    } catch (e) {
      setState({ error: errorText(e).message });
    }
  };

  return (
    <div className="container-page max-w-3xl space-y-6 py-8">
      <h1 className="text-3xl font-bold">{t('my.locationTitle')}</h1>
      <p className="text-muted">{t('my.locationText', { title: listing.title })}</p>
      {state.ok && <Alert tone="success">{t('my.locationSaved')}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Card className="space-y-4">
        <p><span className="text-muted">{t('form.currentTitle')}: </span><span className="font-semibold" data-testid="current-area">{listing.current.label}</span></p>
        <LocationInput testId="update-location" value={picked} onChange={setPicked} />
        <Field label={t('form.label')} hint={t('form.labelHint')} optional={t('common.optional')}>{(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={LIMITS.labelMax} />}</Field>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t('form.visibility')}</legend>
          {CURRENT_VISIBILITIES.map((cv) => (
            <label key={cv} className="flex items-center gap-3">
              <input type="radio" name="visibility" checked={(visibility ?? listing.current.visibility) === cv} onChange={() => setVisibility(cv)} className="size-5 accent-leaf-600" />
              {t(`location.precision.${cv}`)}
            </label>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <Button onClick={save} loading={state.busy} disabled={!picked} data-testid="save-location">{t('common.save')}</Button>
          <Link href="/my-listings" className="inline-flex min-h-12 items-center px-4 font-semibold text-leaf-700">{t('common.back')}</Link>
        </div>
      </Card>
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t('my.history')}</h2>
          <ul className="divide-y divide-soil-100 rounded-2xl border border-soil-200 bg-white">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 p-3">
                <span>{h.label}</span>
                <time className="shrink-0 text-sm text-muted" dateTime={h.createdAt}>{format.dateTime(new Date(h.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequireAuth><UpdateLocation id={id} /></RequireAuth>;
}
