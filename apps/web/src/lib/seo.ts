import { DEFAULT_LOCALE, LOCALES } from '@yantramitra/shared-types';
import type { Metadata } from 'next';
import { siteUrl } from './server-api';

export const localePrefix = (locale: string) => (locale === DEFAULT_LOCALE ? '' : `/${locale}`);
export const localeUrl = (locale: string, path: string) => `${siteUrl()}${localePrefix(locale)}${path === '/' ? '' : path}` || siteUrl();

/** Canonical URL, hreflang alternates and Open Graph for a public page. */
export function pageMetadata(opts: { locale: string; path: string; title: string; description: string; index?: boolean }): Metadata {
  const url = localeUrl(opts.locale, opts.path);
  return {
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical: url,
      languages: { ...Object.fromEntries(LOCALES.map((l) => [`${l}-IN`, localeUrl(l, opts.path)])), 'x-default': localeUrl(DEFAULT_LOCALE, opts.path) },
    },
    openGraph: { title: opts.title, description: opts.description, url, siteName: 'YantraMitra', type: 'website', locale: `${opts.locale}_IN` },
    twitter: { card: 'summary', title: opts.title, description: opts.description },
    robots: opts.index === false ? { index: false, follow: true } : undefined,
  };
}

/** Private, signed-in pages are never indexed. */
export const privateMetadata: Metadata = { robots: { index: false, follow: false } };
