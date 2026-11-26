import 'server-only';
import { ApiError, createApiClient } from '@yantramitra/api-client';
import { notFound } from 'next/navigation';

/** Used by Server Components. Talks to the API directly; public data only, never user sessions. */
export const serverApi = createApiClient({
  baseUrl: `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/v1`,
  clientType: 'web',
  headers: process.env.INTERNAL_API_KEY ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY } : {},
});

/** Short cache for public pages. */
export const revalidate = (seconds: number) => ({ next: { revalidate: seconds } });

export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
