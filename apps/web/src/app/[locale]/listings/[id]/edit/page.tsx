'use client';
import { useTranslations } from 'next-intl';
import { use } from 'react';
import { ListingWizard } from '@/components/listing-wizard';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Skeleton } from '@/components/ui';
import { useOwnListing } from '@/components/use-own-listing';

function Edit({ id }: { id: string }) {
  const t = useTranslations('form');
  const { listing, error } = useOwnListing(id);
  return (
    <div className="container-page max-w-3xl space-y-6 py-8">
      <h1 className="text-3xl font-bold">{t('editTitle')}</h1>
      {error && <Alert tone="error">{error}</Alert>}
      {!listing && !error && <Skeleton className="h-96" />}
      {listing && <ListingWizard listing={listing} />}
    </div>
  );
}

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequireAuth><Edit id={id} /></RequireAuth>;
}
