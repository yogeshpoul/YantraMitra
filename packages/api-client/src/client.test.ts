import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './index.js';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const session = { accessToken: 'new', accessTokenExpiresIn: 900, refreshToken: 'r2', user: { id: 'u' } };

function nativeClient(fetchMock: typeof fetch, initial: string | null = 'r1') {
  let token = initial;
  const onSessionLost = vi.fn();
  const client = createApiClient({
    baseUrl: '/api', clientType: 'native', fetch: fetchMock, onSessionLost,
    refreshTokenStore: { get: async () => token, set: async (t) => void (token = t) },
  });
  return { client, onSessionLost, token: () => token };
}

describe('api client', () => {
  it('shares one refresh between concurrent requests and stores the rotated token', async () => {
    const calls: string[] = [];
    const { client, token } = nativeClient((async (url: string) => {
      calls.push(url);
      return url.endsWith('/auth/refresh') ? json(200, session) : json(200, { ok: true });
    }) as typeof fetch);
    await Promise.all([client.auth.me(), client.auth.me(), client.users.listings()]);
    expect(calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(token()).toBe('r2');
  });

  it('reports a lost session when refresh is rejected', async () => {
    const { client, onSessionLost, token } = nativeClient((async () => json(401, { code: 'SESSION_EXPIRED' })) as typeof fetch);
    await expect(client.auth.me()).rejects.toMatchObject({ status: 401 });
    expect(onSessionLost).toHaveBeenCalledOnce();
    expect(token()).toBeNull();
  });

  it('keeps the session on network failure', async () => {
    const { client, onSessionLost, token } = nativeClient((async () => { throw new Error('offline'); }) as typeof fetch);
    await expect(client.auth.me()).rejects.toBeInstanceOf(ApiError);
    expect(onSessionLost).not.toHaveBeenCalled();
    expect(token()).toBe('r1');
  });

  it('retries once after an expired access token', async () => {
    let first = true;
    const { client } = nativeClient((async (url: string) => {
      if (url.endsWith('/auth/refresh')) return json(200, session);
      if (first) { first = false; return json(401, { code: 'UNAUTHENTICATED' }); }
      return json(200, { id: 'u' });
    }) as typeof fetch);
    await expect(client.auth.me()).resolves.toEqual({ id: 'u' });
  });
});
