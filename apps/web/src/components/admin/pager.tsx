'use client';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const t = useTranslations('search');
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <Button variant="secondary" className="min-h-10" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('prev')}</Button>
      <span className="text-muted">{t('pageOf', { page, total: totalPages })}</span>
      <Button variant="secondary" className="min-h-10" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>{t('nextPage')}</Button>
    </div>
  );
}
