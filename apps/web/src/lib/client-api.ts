'use client';
import { createApiClient } from '@yantramitra/api-client';

type Listener = () => void;
const sessionLostListeners = new Set<Listener>();
export const onSessionLost = (fn: Listener) => {
  sessionLostListeners.add(fn);
  return () => void sessionLostListeners.delete(fn);
};

/** Browser client. Same origin (/api/v1 is proxied), refresh token lives in an HttpOnly cookie. */
export const api = createApiClient({
  baseUrl: '/api/v1',
  clientType: 'web',
  onSessionLost: () => sessionLostListeners.forEach((fn) => fn()),
});
