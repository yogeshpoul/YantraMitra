'use client';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { ChangePasswordForm } from '@/components/auth-forms';
import { RequireAuth } from '@/components/require-auth';
import { Card } from '@/components/ui';

export default function ChangePasswordPage() {
  const t = useTranslations('auth');
  return (
    <RequireAuth>
      <div className="container-page max-w-md py-10">
        <Card className="space-y-5 p-6">
          <h1 className="text-3xl font-bold">{t('changePasswordTitle')}</h1>
          <Suspense><ChangePasswordForm /></Suspense>
        </Card>
      </div>
    </RequireAuth>
  );
}
