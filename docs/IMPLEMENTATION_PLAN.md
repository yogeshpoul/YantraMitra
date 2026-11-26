# YantraMitra — Implementation Plan

## 1. Repository inspection (Phase 0)

| Item | Finding |
| --- | --- |
| Repository | Empty directory, not yet a git repository. Nothing to preserve or migrate. |
| Node / package manager | Node 22.21, pnpm 9.10 |
| Docker | **Not installed** on the development machine |
| PostgreSQL | Native 16.2 service on port 5432, **without PostGIS** |
| Android SDK | Present; 8 GB of RAM makes an emulator impractical |

Because Docker is unavailable on the machine, two equivalent local database paths exist:
`docker compose up -d db` (recommended where Docker is available), and `scripts/devdb.ps1`, a
project-local PostgreSQL + PostGIS cluster on port 55432 that never touches an installed service.

## 2. Architecture

```
 Next.js web (SSR, same-origin /api proxy) ─┐
                                            ├─► NestJS API /api/v1 ─► PostgreSQL 16 + PostGIS
 Expo Android (bearer + SecureStore) ───────┘        (modular monolith)
```

Monorepo (pnpm workspaces):

| Path | Purpose |
| --- | --- |
| `apps/api` | NestJS modular monolith. All business rules live here. |
| `apps/web` | Next.js App Router, farmer site + `/admin`. |
| `apps/mobile` | Expo / React Native, Expo Router. |
| `packages/shared-types` | Enums, API contract types, status-transition table. |
| `packages/shared-validation` | Zod schemas and phone normalisation. The **same** schemas validate API DTOs, generate OpenAPI and drive client forms. |
| `packages/api-client` | Typed fetch client used by web and mobile (token refresh, error mapping). |
| `packages/i18n` | `locales/{en,mr,hi}.json` shared by web and mobile. |
| `packages/illustrations` | Equipment SVG shapes, rendered by both web and mobile. |
| `packages/config` | TypeScript base config. |

### Version decisions

| Choice | Reason |
| --- | --- |
| Prisma **7.10.1 pinned** | npm `latest` for the CLI is an 8.0 release candidate; not used. |
| TypeScript **6.0** | 7.x is not yet supported by typescript-eslint or the Nest tooling. |
| NestJS 12, ESM, Vitest | Current stable line; Nest 12 ships ESM only. |
| Zod DTOs instead of class-validator | One schema for API validation, Swagger and forms. No duplicated rules. |

### Key design decisions

1. **Authentication.** Mobile + password (Argon2id). 15-minute access JWT bound to a DB session, and a rotating opaque refresh token stored hashed with reuse detection. Web receives the refresh token only as an HttpOnly cookie; native clients only in the response body. Every request re-checks session, user status and password-change obligation, so suspension is immediate.
2. **No OTP.** `User.phoneVerifiedAt` and `Session` are the only hooks OTP would need later.
3. **Password recovery.** An admin generates a one-time temporary password (24 h expiry), which is shown once, revokes all sessions and forces a change at next login. Identity checking is an offline admin procedure — see `docs/OPERATIONS.md`.
4. **Admins.** `AdminUser` is a row linked to a `User`. No HTTP endpoint can create one; only the CLI can.
5. **Location privacy.** Three geographies per listing: `home_location`, `current_location` (both private) and `search_location` (public projection of current location, snapped to a ~1.1 km grid unless the owner opts into `exact`). Public search, distance and sort use only `search_location`, so radius probing cannot recover an exact position.
6. **Public locality names** come from the gazetteer, never from the owner's free-text label.
7. **Gazetteer.** GeoNames (CC BY 4.0) imported to the `places` table gives free, offline village/city/taluka/district/state/PIN search, including Devanagari names. The `LocationProvider` abstraction also has optional Nominatim and Google providers.
8. **Languages in URLs.** Marathi unprefixed (default), `/hi` and `/en` prefixed with hreflang, which keeps `/equipment/near/pune`-style URLs.

## 3. Development sequence

| Phase | Content |
| --- | --- |
| 1 | Monorepo, Docker, PostGIS, Nest, Prisma, shared packages, Swagger, health, CI |
| 2 | Auth, users, admin CLI |
| 3 | Catalogue, listings |
| 4 | Locations, gazetteer, PostGIS search, privacy |
| 5 | Web marketplace |
| 6 | Admin API + UI |
| 7 | Android |
| 8 | SEO, tests, hardening, deployment docs |

Progress and verification evidence: `docs/STATUS.md`.

## 4. Risks and dependencies

| Risk | Mitigation |
| --- | --- |
| Without OTP, a person can register someone else's number | Accepted for MVP. `phoneVerifiedAt` stays null, the UI never claims "verified", admin can suspend. Revisit before scaling. |
| Registration necessarily reveals whether a number is taken | Rate-limited; login errors remain generic. |
| Phone-number scraping by registered users | Per-user reveal limit + `ContactEvent` log. |
| In-memory IP throttling is per API instance | Login throttling is in PostgreSQL. Move the IP throttler to Redis when running more than one instance. |
| OSM tile usage policy | Tile URL is configurable; switch to a hosted provider as traffic grows. |
| GeoNames village coordinates can be imprecise | Owner can use GPS or drag the pin. |
| Marathi/Hindi copy | Needs native-speaker review before launch. |
