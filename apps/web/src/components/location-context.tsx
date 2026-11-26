'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface SearchLocation {
  source: 'gps' | 'place';
  label: string;
  lat: number;
  lng: number;
  /** Gazetteer slug when chosen from search */
  slug: string | null;
}

interface LocationState {
  location: SearchLocation | null;
  radiusKm: number;
  ready: boolean;
  setLocation: (l: SearchLocation | null) => void;
  setRadiusKm: (km: number) => void;
}

const KEY = 'ym.searchLocation';
const DEFAULT_RADIUS_KM = 25;
const LocationContext = createContext<LocationState | null>(null);

/** The visitor's chosen search location, remembered on this device only. No default city. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<SearchLocation | null>(null);
  const [radiusKm, setRadiusState] = useState(DEFAULT_RADIUS_KM);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { location: SearchLocation | null; radiusKm: number } | null;
      if (saved) {
        setLocationState(saved.location);
        if (saved.radiusKm) setRadiusState(saved.radiusKm);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  const persist = useCallback((l: SearchLocation | null, r: number) => {
    try { localStorage.setItem(KEY, JSON.stringify({ location: l, radiusKm: r })); } catch { /* storage unavailable */ }
  }, []);

  const setLocation = useCallback((l: SearchLocation | null) => { setLocationState(l); persist(l, radiusKm); }, [persist, radiusKm]);
  const setRadiusKm = useCallback((r: number) => { setRadiusState(r); persist(location, r); }, [persist, location]);

  const value = useMemo(() => ({ location, radiusKm, ready, setLocation, setRadiusKm }), [location, radiusKm, ready, setLocation, setRadiusKm]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useSearchLocation(): LocationState {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useSearchLocation outside LocationProvider');
  return ctx;
}

export type GeoError = 'denied' | 'unavailable';
/** One-off position request. Never watches or tracks in the background. */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject('unavailable' satisfies GeoError);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      (e) => reject((e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable') satisfies GeoError),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}
