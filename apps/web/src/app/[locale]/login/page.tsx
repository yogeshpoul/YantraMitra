import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth-forms';
import { Card } from '@/components/ui';
import { privateMetadata } from '@/lib/seo';

export const metadata = privateMetadata;

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <div className="container-page max-w-md py-10">
      <Card className="space-y-5 p-6">
        <h1 className="text-3xl font-bold">{t('loginTitle')}</h1>
        <Suspense><LoginForm /></Suspense>
      </Card>
    </div>
  );
}
