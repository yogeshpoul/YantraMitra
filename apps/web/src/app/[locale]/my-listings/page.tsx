'use client';
import type { OwnerListingDto, Paginated } from '@yantramitra/shared-types';
import { MapPin, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/dialog';
import { EquipmentArt } from '@/components/equipment-art';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Badge, Button, buttonClass, cx, EmptyState, Skeleton } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useErrorText } from '@/lib/errors';
import { pickName, priceLabel } from '@/lib/format';

const TABS = ['all', 'active', 'inactive', 'unavailable', 'suspended'] as const;
type Tab = (typeof TABS)[number];

function MyListings() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const errorText = useErrorText();
  const [tab, setTab] = useState<Tab>('all');
  const [data, setData] = useState<Paginated<OwnerListingDto> | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<OwnerListingDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setData(null);
    api.users.listings({ status: tab === 'all' ? undefined : tab, pageSize: 50 }).then(setData, (e) => setMessage({ tone: 'error', text: errorText(e).message }));
  }, [tab, errorText]);
  useEffect(load, [load]);

  const setStatus = async (l: OwnerListingDto, status: 'active' | 'inactive' | 'unavailable') => {
    setBusy(l.id);
    try {
      await api.equipment.setStatus(l.id, status);
      setMessage({ tone: 'success', text: t('my.statusChanged') });
      load();
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e).message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(toDelete.id);
    try {
      await api.equipment.remove(toDelete.id);
      setToDelete(null);
      load();
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container-page space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t('my.title')}</h1>
        <Link href="/listings/new" className={buttonClass('primary')}><PlusCircle className="size-5" />{t('nav.addEquipment')}</Link>
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto">
        {TABS.map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
            className={cx('min-h-11 shrink-0 rounded-full px-4 font-medium', tab === s ? 'bg-leaf-600 text-white' : 'bg-white text-ink hover:bg-leaf-50')}>
            {t(`my.tabs.${s}`)}
          </button>
        ))}
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {!data && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>}
      {data && data.items.length === 0 && (
        <EmptyState icon={<EquipmentArt iconKey="tractor" className="h-20" />} title={t('my.empty')}
          action={<Link href="/listings/new" className={buttonClass('primary')}>{t('my.emptyCta')}</Link>} />
      )}
      <ul className="space-y-3">
        {data?.items.map((l) => (
          <li key={l.id} className="rounded-2xl border border-soil-200 bg-white p-4" data-testid="my-listing">
            <div className="flex gap-4">
              <div className="hidden size-24 shrink-0 items-center justify-center rounded-xl bg-leaf-50 sm:flex">
                <EquipmentArt iconKey={l.type.iconKey} fallbackKey={l.category.iconKey} className="h-16" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={l.status === 'active' ? 'green' : l.status === 'suspended' ? 'red' : 'amber'}>{t(`listing.status.${l.status}`)}</Badge>
                  <span className="text-sm text-muted">{pickName(l.type.names, locale)}</span>
                </div>
                <h2 className="truncate text-lg font-semibold">
                  {l.status === 'active' || l.status === 'unavailable' ? <Link href={l.path} className="hover:underline">{l.title}</Link> : l.title}
                </h2>
                <p className="font-semibold">{priceLabel(l.pricing, t, locale)}</p>
                <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-4" aria-hidden />{l.current.label} ·{' '}
                  <span suppressHydrationWarning>{format.relativeTime(new Date(l.location.updatedAt), new Date())}</span></p>
                {l.status === 'suspended' && <Alert tone="error">{t('my.suspendedNote', { reason: l.suspendedReason ?? '' })}</Alert>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-soil-100 pt-3">
              {l.status !== 'suspended' && (
                <>
                  <Link href={`/listings/${l.id}/location`} className={buttonClass('primary', 'min-h-10')}><MapPin className="size-4" />{t('my.updateLocation')}</Link>
                  <Link href={`/listings/${l.id}/edit`} className={buttonClass('secondary', 'min-h-10')}><Pencil className="size-4" />{t('common.edit')}</Link>
                  {l.status !== 'active' && <Button variant="secondary" className="min-h-10" loading={busy === l.id} onClick={() => setStatus(l, 'active')}>{t('my.activate')}</Button>}
                  {l.status === 'active' && <Button variant="secondary" className="min-h-10" loading={busy === l.id} onClick={() => setStatus(l, 'unavailable')}>{t('my.markUnavailable')}</Button>}
                  {l.status !== 'inactive' && <Button variant="ghost" className="min-h-10" loading={busy === l.id} onClick={() => setStatus(l, 'inactive')} data-testid="deactivate">{t('my.deactivate')}</Button>}
                </>
              )}
              <Button variant="ghost" className="min-h-10 text-red-700" onClick={() => setToDelete(l)}><Trash2 className="size-4" />{t('common.delete')}</Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={toDelete !== null} onClose={() => setToDelete(null)} onConfirm={remove} loading={busy === toDelete?.id}
        title={t('my.deleteTitle')} text={t('my.deleteText')} confirmLabel={t('common.delete')} danger />
    </div>
  );
}

export default function MyListingsPage() {
  return <RequireAuth><MyListings /></RequireAuth>;
}

