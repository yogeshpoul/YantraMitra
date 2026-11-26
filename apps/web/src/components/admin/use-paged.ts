'use client';
import type { Paginated } from '@yantramitra/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { useErrorText } from '@/lib/errors';

/** Loads a paginated admin list and reloads when the query changes. */
export function usePaged<T, Q extends Record<string, unknown>>(fetcher: (q: Q & { page: number }) => Promise<Paginated<T>>, query: Q) {
  const errorText = useErrorText();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(query);

  const reload = useCallback(() => {
    setError(null);
    fetcher({ ...(JSON.parse(key) as Q), page }).then(setData, (e) => setError(errorText(e).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fetcher` is a stable API method; `key` captures the query
  }, [key, page, errorText]);

  useEffect(reload, [reload]);
  useEffect(() => setPage(1), [key]);
  return { data, error, page, setPage, reload };
}
