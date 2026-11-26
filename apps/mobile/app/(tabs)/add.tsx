import { useTranslations } from 'use-intl';
import { ListingForm } from '@/ListingForm';
import { SignedIn } from '@/SignedIn';
import { H1, Screen } from '@/ui';

export default function Add() {
  const t = useTranslations('form');
  return (
    <SignedIn>
      <Screen>
        <H1>{t('createTitle')}</H1>
        <ListingForm />
      </Screen>
    </SignedIn>
  );
}
