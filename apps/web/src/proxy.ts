import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * Marathi is the suggested default. The browser's Accept-Language is ignored so that most visitors
 * (whose phones are set to English) start in Marathi; a language they choose is remembered in a cookie.
 *
 * The original request is wrapped rather than copied: a copied NextRequest loses Next.js internal
 * routing state and makes the locale middleware redirect to the same URL.
 */
export default function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete('accept-language');
  const withoutLanguage = new Proxy(request, {
    get(target, prop) {
      if (prop === 'headers') return headers;
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return intl(withoutLanguage);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
