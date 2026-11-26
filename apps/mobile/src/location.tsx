import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface SearchLocation {
  label: string;
  lat: number;
  lng: number;
  slug: string | null;
}
interface State {
  location: SearchLocation | null;
  radiusKm: number;
  setLocation: (l: SearchLocation | null) => void;
  setRadiusKm: (r: number) => void;
}
const KEY = 'ym.searchLocation';
const Ctx = createContext<State | null>(null);

/** Remembered search location. No default city; browsing works without any location. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLoc] = useState<SearchLocation | null>(null);
  const [radiusKm, setRadius] = useState(25);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (!v) return;
      const saved = JSON.parse(v) as { location: SearchLocation | null; radiusKm: number };
      setLoc(saved.location);
      setRadius(saved.radiusKm || 25);
    }).catch(() => undefined);
  }, []);
  const save = useCallback((l: SearchLocation | null, r: number) => void AsyncStorage.setItem(KEY, JSON.stringify({ location: l, radiusKm: r })), []);
  const setLocation = useCallback((l: SearchLocation | null) => { setLoc(l); save(l, radiusKm); }, [save, radiusKm]);
  const setRadiusKm = useCallback((r: number) => { setRadius(r); save(location, r); }, [save, location]);
  const value = useMemo(() => ({ location, radiusKm, setLocation, setRadiusKm }), [location, radiusKm, setLocation, setRadiusKm]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearchLocation(): State {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSearchLocation outside LocationProvider');
  return ctx;
}

/**
 * One-off, foreground position request. The app never tracks location in the background;
 * owners update an equipment location manually.
 */
export async function currentPosition(): Promise<{ lat: number; lng: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('denied');
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) };
}
