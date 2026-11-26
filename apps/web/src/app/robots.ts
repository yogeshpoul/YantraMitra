import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/server-api';

const PRIVATE = ['/api/', '/admin', '/login', '/register', '/profile', '/saved', '/my-listings', '/listings/', '/change-password'];

export default function robots(): MetadataRoute.Robots {
  const disallow = PRIVATE.flatMap((p) => [p, `/hi${p}`, `/en${p}`]);
  return { rules: [{ userAgent: '*', allow: '/', disallow }], sitemap: `${siteUrl()}/sitemap.xml` };
}
