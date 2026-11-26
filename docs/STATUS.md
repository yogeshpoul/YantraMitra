# Implementation status

Updated 2026-11-26. All eight phases are implemented. Each line says how it was verified.

| Phase | Status | Evidence |
| --- | --- | --- |
| 0 Inspect and plan | ✅ | `IMPLEMENTATION_PLAN.md`, `DATABASE_DESIGN.md`, `API_SPECIFICATION.md` |
| 1 Foundation | ✅ | Monorepo, NestJS 12 API, Prisma 7 + PostGIS migrations, Swagger, health endpoints, CI workflow |
| 2 Auth and users | ✅ | `apps/api/test/auth.e2e.test.ts`, `contact-admin.e2e.test.ts` |
| 3 Catalogue and listings | ✅ | `equipment.e2e.test.ts` |
| 4 Location | ✅ | `location.e2e.test.ts`; GeoNames import of 556,749 places + 19,238 PIN codes |
| 5 Web marketplace | ✅ | `apps/web/e2e/marketplace.spec.ts` (Playwright, phone viewport, real stack) |
| 6 Admin | ✅ | `contact-admin.e2e.test.ts` (API), `apps/web/e2e/admin.spec.ts` (browser) |
| 7 Android | ✅ bundle + runtime smoke | `expo export --platform android` (Hermes bundle, 1,515 modules); `apps/web/e2e/mobile-app.spec.ts` drives the app's screens via its web export |
| 8 SEO, tests, production | ✅ | Sitemap/robots/canonical/hreflang/JSON-LD; Dockerfiles; compose; CI; README, DEPLOYMENT, OPERATIONS |

## Latest verification (this machine)

| Check | Result |
| --- | --- |
| `pnpm lint` | clean |
| `pnpm typecheck` (all 9 workspaces) | clean |
| API end-to-end against PostGIS | 52/52, twice in a row |
| shared-validation, api-client, i18n parity | 35/35, 4/4, 6/6 |
| Playwright: marketplace, admin, Android smoke | 12/12 |
| Production API package (`pnpm deploy --prod`) | starts, serves catalogue, `prisma migrate status` up to date |
| Next.js standalone server (as in the Docker image) | serves all locales |

## Not verified here

- **Docker images and `docker compose`**: Docker is not installed on this machine. The steps inside the Dockerfiles (`pnpm deploy`, standalone build) were run natively and work.
- **GitHub Actions CI**: the folder is not yet a git repository, so the workflow has not run.
- **Android on a device or emulator**: 8 GB RAM is too little for an emulator. The release bundle compiles; screens were exercised through the web export. Native-only parts (SecureStore, GPS permission dialog, WebView map, `tel:` and WhatsApp links) need a test on a real phone with Expo Go or a development build.
- **Google Maps and Nominatim providers**: implemented, but not exercised (no keys; the free local gazetteer is the default).

## Bugs found and fixed while verifying

- Mobile: endless refetch loop (unstable error-helper identity in effect dependencies).
- Mobile: login stacked a second copy of the screen that requested it; now returns to it.
- Web: a `next` path that already had a language prefix was prefixed twice (`/en/en/...`).
- Web: admin pages overflowed phone screens, pushing dialogs off-screen.
- Web: relative times rendered without a reference "now" (next-intl environment error in logs).
- Gazetteer: diacritics in state names ("Mahārāshtra"); re-imports now also refresh listing area names.

## Open review items

1. Marathi and Hindi copy needs a native-speaker review before launch.
2. Plural counts in Marathi render in Devanagari digits (ICU default for `mr`) while prices use Latin digits.
3. Without OTP, phone numbers are not verified (see `OPERATIONS.md`, "Known risks").
4. Development database contains e2e test leftovers (test users, an "E2E mulching" operation). Recreate it with `scripts/devdb.ps1` if a clean demo is needed.

## Local environment (this machine)

- Database: `powershell -ExecutionPolicy Bypass -File scripts\devdb.ps1 start|stop` (PostGIS on 127.0.0.1:55432).
- API: `cd apps/api && node dist/main.js` (:4000). Website: `pnpm dev:web`, or the standalone build `node apps/web/.next/standalone/apps/web/server.js` with `HOSTNAME=0.0.0.0`.
- Sample owners: +917000000010–14, password `demo-pass-2025` (development only).
- Local admin for the admin browser tests: credentials in `.local/e2e-admin.env` (gitignored).
