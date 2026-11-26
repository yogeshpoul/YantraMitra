'use client';
import type { OwnerListingDto } from '@yantramitra/shared-types';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import { useErrorText } from '@/lib/errors';

export function useOwnListing(id: string) {
  const errorText = useErrorText();
  const [listing, setListing] = useState<OwnerListingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.users.listing(id).then((l) => alive && setListing(l), (e) => alive && setError(errorText(e).message));
    return () => { alive = false; };
  }, [id, errorText]);
  return { listing, setListing, error };
}
