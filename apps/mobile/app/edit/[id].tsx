import type { OwnerListingDto } from '@yantramitra/shared-types';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { api } from '@/api';
import { useErrors } from '@/errors';
import { ListingForm } from '@/ListingForm';
import { SignedIn } from '@/SignedIn';
import { Banner, Loading, Screen } from '@/ui';

function Edit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const errors = useErrors();
  const [listing, setListing] = useState<OwnerListingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.users.listing(id).then(setListing, (e) => setError(errors.api(e).message)); }, [id, errors]);
  return <Screen>{error ? <Banner tone="error">{error}</Banner> : listing ? <ListingForm listing={listing} /> : <Loading />}</Screen>;
}

export default function EditScreen() {
  return <SignedIn><Edit /></SignedIn>;
}
