'use client';
import type { AdminDashboardDto } from '@yantramitra/shared-types';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Alert, Card, Skeleton } from '@/components/ui';
import { api } from '@/lib/client-api';
import { useErrorText } from '@/lib/errors';

export default function AdminDashboard() {
  const t = useTranslations('admin');
  const errorText = useErrorText();
  const [d, setD] = useState<AdminDashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.admin.dashboard().then(setD, (e) => setError(errorText(e).message)); }, [errorText]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!d) return <Skeleton className="h-64" />;
  const metrics: [string, number][] = [
    [t('metrics.users'), d.users.total], [t('metrics.newUsers'), d.users.last7Days], [t('metrics.activeListings'), d.listings.active],
    [t('metrics.newListings'), d.listings.last7Days], [t('metrics.openReports'), d.reports.open + d.reports.reviewing],
    [t('metrics.contacts7'), d.contacts.last7Days], [t('metrics.contacts30'), d.contacts.last30Days],
    [t('metrics.suspendedUsers'), d.users.suspended], [t('metrics.suspendedListings'), d.listings.suspended],
  ];
  return (
    <>
      <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="admin-metrics">
        {metrics.map(([label, value]) => (
          <Card key={label} className="p-4"><dt className="text-sm text-muted">{label}</dt><dd className="text-3xl font-bold tabular-nums">{value}</dd></Card>
        ))}
      </dl>
      <Card>
        <h2 className="mb-3 text-xl font-semibold">{t('metrics.topDistricts')}</h2>
        <table className="w-full text-left">
          <tbody>
            {d.topDistricts.map((r) => (
              <tr key={`${r.district}-${r.state}`} className="border-t border-soil-100">
                <td className="py-2">{[r.district, r.state].filter(Boolean).join(', ') || '—'}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
