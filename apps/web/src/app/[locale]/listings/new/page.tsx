'use client';
import { useTranslations } from 'next-intl';
import { ListingWizard } from '@/components/listing-wizard';
import { RequireAuth } from '@/components/require-auth';

export default function NewListingPage() {
  const t = useTranslations('form');
  return (
    <RequireAuth>
      <div className="container-page max-w-3xl space-y-6 py-8">
        <h1 className="text-3xl font-bold">{t('createTitle')}</h1>
        <ListingWizard />
      </div>
    </RequireAuth>
  );
}
