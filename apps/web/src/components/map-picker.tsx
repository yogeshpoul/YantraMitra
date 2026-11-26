'use client';
import 'leaflet/dist/leaflet.css';
import type { LatLng } from '@yantramitra/shared-types';
import { useEffect, useRef, useState } from 'react';

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '© OpenStreetMap contributors';
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

interface Props {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  onError?: () => void;
}

/**
 * Pin picker. Uses Google Maps when a browser key is configured; otherwise Leaflet with
 * OpenStreetMap tiles, which needs no key. Without any map the form still works through search and GPS.
 */
export default function MapPicker(props: Props) {
  return GOOGLE_KEY ? <GooglePicker {...props} apiKey={GOOGLE_KEY} /> : <LeafletPicker {...props} />;
}

const round = (v: number) => Number(v.toFixed(6));
const INDIA_CENTRE: LatLng = { lat: 22.5, lng: 79 };

function LeafletPicker({ value, onChange, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: import('leaflet').Map; marker: import('leaflet').Marker } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !ref.current) return;
      const start = value ?? INDIA_CENTRE;
      const map = L.map(ref.current).setView([start.lat, start.lng], value ? 15 : 5);
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      const icon = L.divIcon({
        className: '', iconSize: [32, 42], iconAnchor: [16, 42],
        html: '<svg viewBox="0 0 32 42" width="32" height="42"><path d="M16 0C7 0 0 7 0 16c0 12 16 26 16 26s16-14 16-26C32 7 25 0 16 0Z" fill="#2f7d3b"/><circle cx="16" cy="16" r="6" fill="#fff"/></svg>',
      });
      const marker = L.marker([start.lat, start.lng], { draggable: true, icon, keyboard: true, opacity: value ? 1 : 0 }).addTo(map);
      const set = (p: { lat: number; lng: number }) => {
        marker.setLatLng(p).setOpacity(1);
        onChangeRef.current({ lat: round(p.lat), lng: round(p.lng) });
      };
      marker.on('dragend', () => set(marker.getLatLng()));
      map.on('click', (e) => set(e.latlng));
      mapRef.current = { map, marker };
    }).catch(() => onError?.());
    return () => { cancelled = true; mapRef.current?.map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; `value` changes are applied below
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !value) return;
    const cur = m.marker.getLatLng();
    if (Math.abs(cur.lat - value.lat) > 1e-6 || Math.abs(cur.lng - value.lng) > 1e-6) {
      m.marker.setLatLng([value.lat, value.lng]).setOpacity(1);
      m.map.setView([value.lat, value.lng], Math.max(m.map.getZoom(), 14));
    }
  }, [value]);

  return <div ref={ref} className="h-72 w-full overflow-hidden rounded-xl border border-soil-200 bg-soil-100" data-testid="map-picker" />;
}

interface GoogleMapsGlobal {
  maps: {
    Map: new (el: HTMLElement, opts: object) => { addListener: (e: string, fn: (ev: { latLng: { lat(): number; lng(): number } }) => void) => void; setCenter: (p: LatLng) => void; setZoom: (z: number) => void };
    Marker: new (opts: object) => { setPosition: (p: LatLng) => void; addListener: (e: string, fn: () => void) => void; getPosition: () => { lat(): number; lng(): number } };
  };
}

let googleLoader: Promise<GoogleMapsGlobal> | null = null;
function loadGoogle(key: string): Promise<GoogleMapsGlobal> {
  googleLoader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__ymGoogleReady`;
    s.async = true;
    (window as unknown as Record<string, unknown>).__ymGoogleReady = () => resolve((window as unknown as { google: GoogleMapsGlobal }).google);
    s.onerror = () => { googleLoader = null; reject(new Error('Google Maps failed to load')); };
    document.head.appendChild(s);
  });
  return googleLoader;
}

function GooglePicker({ value, onChange, onError, apiKey }: Props & { apiKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<{ marker: InstanceType<GoogleMapsGlobal['maps']['Marker']>; map: InstanceType<GoogleMapsGlobal['maps']['Map']> } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    loadGoogle(apiKey).then((g) => {
      if (cancelled || !ref.current) return;
      const start = value ?? INDIA_CENTRE;
      const map = new g.maps.Map(ref.current, { center: start, zoom: value ? 15 : 5, streetViewControl: false, mapTypeControl: false });
      const marker = new g.maps.Marker({ position: start, map, draggable: true });
      const set = (lat: number, lng: number) => { marker.setPosition({ lat, lng }); onChangeRef.current({ lat: round(lat), lng: round(lng) }); };
      map.addListener('click', (e) => set(e.latLng.lat(), e.latLng.lng()));
      marker.addListener('dragend', () => { const p = marker.getPosition(); set(p.lat(), p.lng()); });
      setApi({ map, marker });
    }).catch(() => onError?.());
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once
  }, [apiKey]);

  useEffect(() => {
    if (api && value) { api.marker.setPosition(value); api.map.setCenter(value); }
  }, [api, value]);

  return <div ref={ref} className="h-72 w-full overflow-hidden rounded-xl border border-soil-200 bg-soil-100" data-testid="map-picker" />;
}
