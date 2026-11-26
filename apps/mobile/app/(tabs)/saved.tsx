import type { ListingCardDto } from '@yantramitra/shared-types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslations } from 'use-intl';
import { api } from '@/api';
import { ListingCard } from '@/ListingCard';
import { SignedIn } from '@/SignedIn';
import { Banner, H1, Loading, Muted, Screen } from '@/ui';

function Saved() {
  const t = useTranslations();
  const [items, setItems] = useState<ListingCardDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  useFocusEffect(useCallback(() => { api.users.favorites({ pageSize: 50 }).then((r) => setItems(r.items), () => setFailed(true)); }, []));
  return (
    <Screen>
      <H1>{t('saved.title')}</H1>
      {failed && <Banner tone="error">{t('state.errorText')}</Banner>}
      {!items && !failed && <Loading />}
      {items?.length === 0 && <Muted>{t('saved.empty')}</Muted>}
      {items?.map((l) => <ListingCard key={l.id} listing={l} />)}
    </Screen>
  );
}

export default function SavedTab() {
  return <SignedIn><Saved /></SignedIn>;
}
