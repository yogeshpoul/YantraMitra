import '@fontsource/mukta/400.css';
import '@fontsource/mukta/600.css';
import '@fontsource/mukta/700.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-context';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { LocationProvider } from '@/components/location-context';
import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/server-api';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t('homeTitle'), template: `%s | ${locale === 'en' ? 'YantraMitra' : 'यंत्रमित्र'}` },
    description: t('homeDescription'),
    applicationName: 'YantraMitra',
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = { themeColor: '#2f7d3b', width: 'device-width', initialScale: 1 };

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider timeZone="Asia/Kolkata">
          <AuthProvider>
            <LocationProvider>
              <Suspense fallback={<div className="h-16 border-b border-soil-200 bg-white" />}>
                <Header />
              </Suspense>
              <main id="main" className="flex-1">{children}</main>
              <Footer />
            </LocationProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
