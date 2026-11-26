'use client';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from './auth-context';
import { Skeleton } from './ui';

/**
 * Client-side gate for signed-in pages. The API enforces authorisation on every request;
 * this only sends guests to login and brings them back afterwards.
 */
export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('admin');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const query = typeof window === 'undefined' ? '' : window.location.search;
      router.replace(`/login?next=${encodeURIComponent(pathname + query)}`);
    } else if (user.mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password');
    }
  }, [loading, user, router, pathname]);

  if (loading || !user || (user.mustChangePassword && pathname !== '/change-password'))
    return <div className="container-page space-y-4 py-10"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40" /></div>;
  if (admin && !user.isAdmin) return <div className="container-page py-16 text-center text-lg">{t('notAdmin')}</div>;
  return <>{children}</>;
}
