'use client';
import { REPORT_STATUSES, type AdminReportDto } from '@yantramitra/shared-types';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pager } from '@/components/admin/pager';
import { usePaged } from '@/components/admin/use-paged';
import { Alert, Badge, Button, Input, Select, Skeleton } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useErrorText } from '@/lib/errors';

const STATUS_LABEL = { open: 'reportReview', reviewing: 'reportReview', resolved: 'reportResolve', dismissed: 'reportDismiss' } as const;

export default function AdminReports() {
  const t = useTranslations();
  const format = useFormatter();
  const errorText = useErrorText();
  const [status, setStatus] = useState('open');
  const { data, error, page, setPage, reload } = usePaged(api.admin.reports, { status: status || undefined });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const update = async (r: AdminReportDto, next: 'reviewing' | 'resolved' | 'dismissed') => {
    setFailure(null);
    try { await api.admin.updateReport(r.id, { status: next, resolutionNote: notes[r.id] || null }); reload(); } catch (e) { setFailure(errorText(e).message); }
  };

  return (
    <>
      <h1 className="text-3xl font-bold">{t('admin.reports')}</h1>
      <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('admin.status')} className="max-w-xs">
        <option value="">{t('admin.allStatuses')}</option>
        {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      {(error || failure) && <Alert tone="error">{error ?? failure}</Alert>}
      {!data && <Skeleton className="h-64" />}
      <ul className="space-y-2">
        {data?.items.map((r) => (
          <li key={r.id} className="space-y-2 rounded-xl border border-soil-200 bg-white p-4" data-testid="admin-report">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.status === 'open' ? 'red' : r.status === 'reviewing' ? 'amber' : 'green'}>{r.status}</Badge>
              <span className="font-semibold">{t(`listing.reasons.${r.reason}`)}</span>
              <span className="text-sm text-muted">{format.dateTime(new Date(r.createdAt), { dateStyle: 'medium' })}</span>
            </div>
            <p><Link href={r.listing.path} className="font-medium text-leaf-700 underline">{r.listing.title}</Link> <Badge>{t(`listing.status.${r.listing.status}`)}</Badge></p>
            {r.details && <p className="whitespace-pre-line text-muted">{r.details}</p>}
            <p className="text-sm text-muted">{t('admin.reporter')}: {r.reporter.fullName}</p>
            {r.resolutionNote && <p className="text-sm">{t('admin.resolutionNote')}: {r.resolutionNote}</p>}
            {(r.status === 'open' || r.status === 'reviewing') && (
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-60 flex-1" placeholder={t('admin.resolutionNote')} aria-label={t('admin.resolutionNote')} value={notes[r.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                {r.status === 'open' && <Button variant="secondary" className="min-h-10" onClick={() => update(r, 'reviewing')}>{t(`admin.${STATUS_LABEL.reviewing}`)}</Button>}
                <Button className="min-h-10" onClick={() => update(r, 'resolved')}>{t('admin.reportResolve')}</Button>
                <Button variant="ghost" className="min-h-10" onClick={() => update(r, 'dismissed')}>{t('admin.reportDismiss')}</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {data && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}
