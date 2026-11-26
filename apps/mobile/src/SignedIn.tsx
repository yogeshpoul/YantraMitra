import { router, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import { useAuth } from './auth';
import { Button, Loading, Muted, Screen } from './ui';

/** Shows a login prompt to guests; after login the user returns to this screen. */
export function SignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const t = useTranslations();
  const path = usePathname();
  const mustChange = Boolean(user?.mustChangePassword) && path !== '/change-password';

  useEffect(() => {
    if (mustChange) router.replace('/change-password');
  }, [mustChange]);

  if (loading || mustChange) return <Loading />;
  if (!user)
    return (
      <Screen>
        <Muted>{t('auth.loginRequired')}</Muted>
        <Button title={t('nav.login')} onPress={() => router.push({ pathname: '/login', params: { next: path } })} />
        <Button variant="secondary" title={t('nav.register')} onPress={() => router.push({ pathname: '/register', params: { next: path } })} />
      </Screen>
    );
  return <>{children}</>;
}
