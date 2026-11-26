import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { buttonClass } from './ui';

export async function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const t = await getTranslations('search');
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)} rel="prev" className={buttonClass('secondary')}><ChevronLeft className="size-5" />{t('prev')}</Link> : <span />}
      <span className="text-muted">{t('pageOf', { page, total: totalPages })}</span>
      {page < totalPages ? <Link href={href(page + 1)} rel="next" className={buttonClass('secondary')}>{t('nextPage')}<ChevronRight className="size-5" /></Link> : <span />}
    </nav>
  );
}
