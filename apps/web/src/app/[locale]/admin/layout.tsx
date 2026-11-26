'use client';
import { BarChart3, BookOpen, Flag, History, List, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { cx } from '@/components/ui';
import { Link, usePathname } from '@/i18n/navigation';

const NAV = [
  ['/admin', 'dashboard', BarChart3], ['/admin/listings', 'listings', List], ['/admin/users', 'users', Users],
  ['/admin/reports', 'reports', Flag], ['/admin/catalogue', 'catalogue', BookOpen], ['/admin/audit', 'auditLog', History],
] as const;

/** Separate admin area. The API checks admin rights on every call; this only hides the UI from others. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  return (
    <RequireAuth admin>
      <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={t('title')} className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 font-display text-xl font-bold">{t('title')}</p>
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(([href, key, Icon]) => (
              <li key={href}>
                <Link href={href} aria-current={pathname === href ? 'page' : undefined}
                  className={cx('flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 font-medium', pathname === href ? 'bg-leaf-600 text-white' : 'hover:bg-leaf-50')}>
                  <Icon className="size-4" aria-hidden />{t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </RequireAuth>
  );
}
