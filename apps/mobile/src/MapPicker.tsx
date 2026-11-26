import type { LatLng } from '@yantramitra/shared-types';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import { colors, radius } from './theme';

// The library's class typings do not line up with React 19.3's; this narrows them to the props used here.
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<RNWebView> }>;

const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Free map pin picker: Leaflet with OpenStreetMap tiles inside a WebView (no Google key needed).
 * Leaflet is loaded from unpkg with a Subresource Integrity hash.
 */
export function MapPicker({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng) => void }) {
  const ref = useRef<RNWebView>(null);
  const start = value ?? { lat: 22.5, lng: 79 };
  // Built once; later position changes are pushed with injectJavaScript.
  const html = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>html,body,#m{margin:0;height:100%}</style></head><body><div id="m"></div><script>
var m=L.map('m').setView([${start.lat},${start.lng}],${value ? 15 : 5});
L.tileLayer(${JSON.stringify(TILE_URL)},{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(m);
var k=L.marker([${start.lat},${start.lng}],{draggable:true,opacity:${value ? 1 : 0}}).addTo(m);
function send(p){k.setLatLng(p).setOpacity(1);window.ReactNativeWebView.postMessage(JSON.stringify({lat:+p.lat.toFixed(6),lng:+p.lng.toFixed(6)}));}
k.on('dragend',function(){send(k.getLatLng())});m.on('click',function(e){send(e.latlng)});
window.setPin=function(lat,lng){k.setLatLng([lat,lng]).setOpacity(1);m.setView([lat,lng],15)};
</script></body></html>`, []); // eslint-disable-line react-hooks/exhaustive-deps -- map is created once

  useEffect(() => {
    if (value) ref.current?.injectJavaScript(`window.setPin && window.setPin(${value.lat},${value.lng}); true;`);
  }, [value]);

  if (Platform.OS === 'web') return null;

  return (
    <View style={{ height: 260, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.soilBorder }}>
      <WebView ref={ref} originWhitelist={['*']} source={{ html }} javaScriptEnabled
        onMessage={(e) => { try { onChange(JSON.parse(e.nativeEvent.data) as LatLng); } catch { /* ignore */ } }}
        renderError={() => <Text style={{ padding: 12 }}>Map unavailable</Text>} />
    </View>
  );
}
