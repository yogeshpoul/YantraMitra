'use client';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pager } from '@/components/admin/pager';
import { usePaged } from '@/components/admin/use-paged';
import { Alert, Input, Skeleton } from '@/components/ui';
import { api } from '@/lib/client-api';

export default function AdminAudit() {
  const t = useTranslations('admin');
  const format = useFormatter();
  const [action, setAction] = useState('');
  const { data, error, page, setPage } = usePaged(api.admin.auditLogs, { action: action || undefined });
  return (
    <>
      <h1 className="text-3xl font-bold">{t('auditLog')}</h1>
      <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="listing.suspend, user., report." aria-label={t('action')} className="max-w-sm" />
      {error && <Alert tone="error">{error}</Alert>}
      {!data && <Skeleton className="h-64" />}
      {data && (
        <div className="overflow-x-auto rounded-xl border border-soil-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-soil-100"><tr>{[t('when'), t('by'), t('action'), t('entity'), t('changes')].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id} className="border-t border-soil-100 align-top">
                  <td className="whitespace-nowrap p-3">{format.dateTime(new Date(l.createdAt), { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="p-3">{l.adminName}</td>
                  <td className="p-3 font-mono">{l.action}</td>
                  <td className="p-3 font-mono text-xs">{l.entityType}<br />{l.entityId}</td>
                  <td className="p-3"><pre className="max-w-md overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(l.after, null, 1)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}
