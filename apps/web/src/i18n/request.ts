import type { Locale } from '@yantramitra/shared-types';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

const loaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  mr: () => import('@yantramitra/i18n/locales/mr.json'),
  hi: () => import('@yantramitra/i18n/locales/hi.json'),
  en: () => import('@yantramitra/i18n/locales/en.json'),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await loaders[locale]()).default,
    timeZone: 'Asia/Kolkata',
    // Latin digits everywhere, matching phone numbers and form input.
    formats: { number: { inr: { style: 'currency', currency: 'INR', maximumFractionDigits: 0, numberingSystem: 'latn' } } },
  };
});
