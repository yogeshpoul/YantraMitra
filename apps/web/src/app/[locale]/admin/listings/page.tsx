'use client';
import { LISTING_STATUSES, areaText, type AdminListingDto } from '@yantramitra/shared-types';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pager } from '@/components/admin/pager';
import { usePaged } from '@/components/admin/use-paged';
import { Dialog } from '@/components/dialog';
import { Alert, Badge, Button, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useErrorText } from '@/lib/errors';

export default function AdminListings() {
  const t = useTranslations();
  const format = useFormatter();
  const errorText = useErrorText();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, error, page, setPage, reload } = usePaged(api.admin.listings, { q: q || undefined, status: status || undefined });
  const [target, setTarget] = useState<AdminListingDto | null>(null);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});

  const apply = async (l: AdminListingDto, next: 'suspended' | 'active', why?: string) => {
    setState({ busy: true });
    try {
      await api.admin.setListingStatus(l.id, { status: next, reason: why ?? null });
      setTarget(null);
      setReason('');
      setState({});
      reload();
    } catch (e) {
      setState({ error: errorText(e).message });
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold">{t('admin.listings')}</h1>
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.searchListings')} aria-label={t('admin.searchListings')} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('admin.status')}>
          <option value="">{t('admin.allStatuses')}</option>
          {LISTING_STATUSES.map((s) => <option key={s} value={s}>{t(`listing.status.${s}`)}</option>)}
        </Select>
      </div>
      {(error || (state.error && !target)) && <Alert tone="error">{error ?? state.error}</Alert>}
      {!data && <Skeleton className="h-64" />}
      <ul className="space-y-2">
        {data?.items.map((l) => (
          <li key={l.id} className="rounded-xl border border-soil-200 bg-white p-4" data-testid="admin-listing">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={l.status === 'active' ? 'green' : l.status === 'suspended' ? 'red' : 'amber'}>{t(`listing.status.${l.status}`)}</Badge>
                  {l.openReports > 0 && <Badge tone="red">{t('admin.openReportsCount', { count: l.openReports })}</Badge>}
                </div>
                <p className="font-semibold">{l.status === 'active' || l.status === 'unavailable' ? <Link href={l.path} className="hover:underline">{l.title}</Link> : l.title}</p>
                <p className="text-sm text-muted">{t('admin.owner')}: {l.owner.fullName} · {l.owner.mobile} · {areaText(l.area) || '—'}</p>
                <p className="text-sm text-muted">{t('admin.created')}: {format.dateTime(new Date(l.createdAt), { dateStyle: 'medium' })}</p>
                {l.suspendedReason && <p className="text-sm text-red-800">{t('admin.reason')}: {l.suspendedReason}</p>}
              </div>
              {['active', 'inactive', 'unavailable'].includes(l.status) && <Button variant="danger" className="min-h-10" onClick={() => setTarget(l)}>{t('admin.suspend')}</Button>}
              {l.status === 'suspended' && <Button variant="secondary" className="min-h-10" loading={state.busy} onClick={() => apply(l, 'active')}>{t('admin.restore')}</Button>}
            </div>
          </li>
        ))}
      </ul>
      {data && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}
      <Dialog open={target !== null} onClose={() => setTarget(null)} title={`${t('admin.suspend')}: ${target?.title ?? ''}`}>
        <Field label={t('admin.reason')} hint={t('admin.reasonRequired')}>{(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}</Field>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Button variant="danger" className="w-full" disabled={!reason.trim()} loading={state.busy} onClick={() => target && apply(target, 'suspended', reason.trim())}>{t('admin.suspend')}</Button>
      </Dialog>
    </>
  );
}
