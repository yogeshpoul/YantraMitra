'use client';
import { LOCALES, type Locale } from '@yantramitra/shared-types';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useAuth } from './auth-context';

/** Language can be changed at any time; signed-in users also get it saved to their profile. */
export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, setUser } = useAuth();
  const [pending, start] = useTransition();

  const change = (next: Locale) => {
    const query = searchParams.toString();
    start(() => router.replace(`${pathname}${query ? `?${query}` : ''}`, { locale: next }));
    if (user && user.preferredLocale !== next) api.users.update({ preferredLocale: next }).then(setUser, () => undefined);
  };

  return (
    <label className="flex items-center gap-1.5">
      <Languages className="size-5 text-leaf-700" aria-hidden />
      <span className={compact ? 'sr-only' : 'font-medium'}>{t('common.language')}</span>
      <select value={locale} disabled={pending} onChange={(e) => change(e.target.value as Locale)} data-testid="language-select"
        className="min-h-10 rounded-lg border border-soil-200 bg-white px-2 font-medium">
        {LOCALES.map((l) => <option key={l} value={l} lang={l}>{t(`lang.${l}`)}</option>)}
      </select>
    </label>
  );
}
