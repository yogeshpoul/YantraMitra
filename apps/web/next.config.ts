import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const tileOrigin = (() => {
  try {
    return new URL((process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png').replace(/\{[a-z]\}/g, 'a')).origin;
  } catch {
    return 'https://tile.openstreetmap.org';
  }
})();
const google = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? ' https://maps.googleapis.com https://maps.gstatic.com' : '';
const dev = process.env.NODE_ENV !== 'production';

// Next.js needs inline scripts for hydration; everything else is restricted to this origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}${google}`,
  `style-src 'self' 'unsafe-inline'${google ? ' https://fonts.googleapis.com' : ''}`,
  `img-src 'self' data: blob: ${tileOrigin.replace('://', '://*.')} ${tileOrigin}${google}`,
  `font-src 'self'${google ? ' https://fonts.gstatic.com' : ''}`,
  `connect-src 'self'${google}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Container builds: a self-contained server that also traces the workspace packages.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const, outputFileTracingRoot: path.resolve(process.cwd(), '../..') } : {}),
  // Browser calls go to the same origin, so the refresh cookie is first-party and CORS is not needed.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
          ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
        ],
      },
    ];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(config);
