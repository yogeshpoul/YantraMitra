'use client';
import type { ListingCardDto } from '@yantramitra/shared-types';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ListingGrid } from '@/components/listing-card';
import { RequireAuth } from '@/components/require-auth';
import { Alert, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/client-api';

function Saved() {
  const t = useTranslations();
  const [items, setItems] = useState<ListingCardDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api.users.favorites({ pageSize: 50 }).then((r) => setItems(r.items), () => setFailed(true)); }, []);
  return (
    <div className="container-page space-y-6 py-8">
      <h1 className="text-3xl font-bold">{t('saved.title')}</h1>
      {failed && <Alert tone="error">{t('state.errorText')}</Alert>}
      {!items && !failed && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80" />)}</div>}
      {items?.length === 0 && <EmptyState icon={<Heart className="size-12" />} title={t('saved.empty')} />}
      {items && items.length > 0 && <ListingGrid items={items} />}
    </div>
  );
}

export default function SavedPage() {
  return <RequireAuth><Saved /></RequireAuth>;
}
