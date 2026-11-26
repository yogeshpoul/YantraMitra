import { DEFAULT_LOCALE, LOCALES } from '@yantramitra/shared-types';
import { defineRouting } from 'next-intl/routing';

/** Marathi URLs carry no prefix (/equipment); Hindi and English do (/hi/equipment, /en/equipment). */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' },
});
