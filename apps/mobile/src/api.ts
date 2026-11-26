import { createApiClient, type RefreshTokenStore } from '@yantramitra/api-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'ym.refreshToken';
const listeners = new Set<() => void>();
export const onSessionLost = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/**
 * Refresh token in the Android Keystore-backed SecureStore. The web preview (development only)
 * keeps it in memory, so a browser never stores it persistently.
 */
let memoryToken: string | null = null;
const store: RefreshTokenStore = Platform.OS === 'web'
  ? { get: async () => memoryToken, set: async (t) => void (memoryToken = t) }
  : {
      get: () => SecureStore.getItemAsync(KEY),
      set: async (t) => (t ? SecureStore.setItemAsync(KEY, t) : SecureStore.deleteItemAsync(KEY)),
    };

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000/api/v1';

export const api = createApiClient({
  baseUrl: API_URL,
  clientType: 'native',
  refreshTokenStore: store,
  onSessionLost: () => listeners.forEach((fn) => fn()),
});
