import { router } from 'expo-router';

/** Only in-app paths are accepted as a return target after login. */
export const safeNext = (next: string | undefined) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

/**
 * After login, return to the screen that asked for it (instead of stacking a second copy of it);
 * otherwise go to the requested in-app path.
 */
export function returnAfterAuth(next: string | undefined): void {
  if (next && router.canGoBack()) router.back();
  else router.replace(safeNext(next) as never);
}
