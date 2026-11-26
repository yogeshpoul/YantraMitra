'use client';
import type { AdminUserDto, TempPasswordDto } from '@yantramitra/shared-types';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pager } from '@/components/admin/pager';
import { usePaged } from '@/components/admin/use-paged';
import { ConfirmDialog, Dialog } from '@/components/dialog';
import { Alert, Badge, Button, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { api } from '@/lib/client-api';
import { useErrorText } from '@/lib/errors';

export default function AdminUsers() {
  const t = useTranslations();
  const format = useFormatter();
  const errorText = useErrorText();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, error, page, setPage, reload } = usePaged(api.admin.users, { q: q || undefined, status: status || undefined });
  const [suspending, setSuspending] = useState<AdminUserDto | null>(null);
  const [resetting, setResetting] = useState<AdminUserDto | null>(null);
  const [temp, setTemp] = useState<TempPasswordDto | null>(null);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});

  const run = async (fn: () => Promise<unknown>) => {
    setState({ busy: true });
    try { await fn(); setState({}); reload(); return true; } catch (e) { setState({ error: errorText(e).message }); return false; }
  };

  return (
    <>
      <h1 className="text-3xl font-bold">{t('admin.users')}</h1>
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.searchUsers')} aria-label={t('admin.searchUsers')} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('admin.status')}>
          <option value="">{t('admin.allStatuses')}</option>
          <option value="active">{t('admin.active')}</option>
          <option value="suspended">{t('listing.status.suspended')}</option>
        </Select>
      </div>
      {(error || state.error) && <Alert tone="error">{error ?? state.error}</Alert>}
      {!data && <Skeleton className="h-64" />}
      <ul className="space-y-2">
        {data?.items.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-soil-200 bg-white p-4" data-testid="admin-user">
            <div className="space-y-1">
              <p className="font-semibold">{u.fullName} <span className="font-normal text-muted">· {u.mobile}</span></p>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status === 'active' ? t('admin.active') : t('listing.status.suspended')}</Badge>
                {u.isAdmin && <Badge tone="amber">{t('admin.adminBadge')}</Badge>}
                {u.mustChangePassword && <Badge>{t('admin.mustChangeBadge')}</Badge>}
                <span className="text-muted">{t('admin.listingCount')}: {u.listingCount}</span>
                <span className="text-muted">{t('admin.lastLogin')}: {u.lastLoginAt ? format.dateTime(new Date(u.lastLoginAt), { dateStyle: 'medium' }) : '—'}</span>
              </div>
            </div>
            {!u.isAdmin && (
              <div className="flex gap-2">
                <Button variant="secondary" className="min-h-10" onClick={() => setResetting(u)}>{t('admin.resetPassword')}</Button>
                {u.status === 'active'
                  ? <Button variant="danger" className="min-h-10" onClick={() => setSuspending(u)}>{t('admin.suspend')}</Button>
                  : <Button variant="secondary" className="min-h-10" loading={state.busy} onClick={() => run(() => api.admin.setUserStatus(u.id, { status: 'active' }))}>{t('admin.reactivate')}</Button>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {data && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}

      <Dialog open={suspending !== null} onClose={() => setSuspending(null)} title={`${t('admin.suspend')}: ${suspending?.fullName ?? ''}`}>
        <Field label={t('admin.reason')} hint={t('admin.reasonRequired')}>{(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}</Field>
        <Button variant="danger" className="w-full" disabled={!reason.trim()} loading={state.busy}
          onClick={async () => { if (suspending && await run(() => api.admin.setUserStatus(suspending.id, { status: 'suspended', reason: reason.trim() }))) { setSuspending(null); setReason(''); } }}>
          {t('admin.suspend')}
        </Button>
      </Dialog>

      <ConfirmDialog open={resetting !== null} onClose={() => setResetting(null)} title={t('admin.resetPassword')} text={t('admin.resetConfirm')} confirmLabel={t('common.confirm')} loading={state.busy}
        onConfirm={async () => {
          if (!resetting) return;
          setState({ busy: true });
          try { setTemp(await api.admin.resetPassword(resetting.id)); setResetting(null); setState({}); reload(); } catch (e) { setState({ error: errorText(e).message }); setResetting(null); }
        }} />

      <Dialog open={temp !== null} onClose={() => setTemp(null)} title={t('admin.tempPasswordTitle')}>
        {temp && (
          <>
            <p className="select-all rounded-xl bg-soil-100 p-4 text-center font-mono text-2xl tracking-wider" data-testid="temp-password">{temp.temporaryPassword}</p>
            <p className="text-muted">{t('admin.tempPasswordText', { time: format.dateTime(new Date(temp.expiresAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
          </>
        )}
      </Dialog>
    </>
  );
}
