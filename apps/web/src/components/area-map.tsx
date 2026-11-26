'use client';
import 'leaflet/dist/leaflet.css';
import type { LatLng } from '@yantramitra/shared-types';
import { useEffect, useRef } from 'react';

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '© OpenStreetMap contributors';

/** Read-only map of the public (approximate) area: a circle, never a pin on an exact spot. */
export default function AreaMap({ point, radiusM }: { point: LatLng; radiusM: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import('leaflet').Map | undefined;
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, dragging: !L.Browser.mobile, attributionControl: true }).setView([point.lat, point.lng], 13);
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
      L.circle([point.lat, point.lng], { radius: radiusM, color: '#2f7d3b', fillColor: '#84c07c', fillOpacity: 0.3 }).addTo(map);
    });
    return () => { cancelled = true; map?.remove(); };
  }, [point.lat, point.lng, radiusM]);
  return <div ref={ref} className="h-56 w-full overflow-hidden rounded-xl border border-soil-200 bg-soil-100" role="img" aria-label="Map" />;
}
