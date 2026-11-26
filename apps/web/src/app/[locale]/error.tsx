'use client';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@/components/ui';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <div className="container-page py-16">
      <EmptyState title={t('state.errorTitle')} text={t('state.errorText')} action={<Button onClick={reset}>{t('common.retry')}</Button>} />
    </div>
  );
}
