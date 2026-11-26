# Deployment

A small pilot runs comfortably on one Linux VM (2 vCPU, 4 GB RAM) with a managed PostgreSQL + PostGIS, or with the database on the same VM.

```
Internet ── HTTPS reverse proxy (Caddy / nginx) ── web :3000 (Next.js)
                     │                                  │ server-side calls with X-Internal-Key
                     └── /api/v1/* ───────────────────► api :4000 (NestJS) ── PostgreSQL 16 + PostGIS
```

Route `/api/v1/*` straight to the API at the proxy (the website also proxies it, but the direct route saves a hop). Keep the website and API on the **same site** so the refresh-token cookie stays first-party.

## 1. Database

PostgreSQL 16 with PostGIS 3.4+ and `pg_trgm` (AWS RDS, Google Cloud SQL, Azure Flexible Server, DigitalOcean and Supabase all provide both). Create a dedicated role and database; the migrations create the extensions, so the role needs permission to, or an administrator creates them once:

```sql
CREATE EXTENSION postgis; CREATE EXTENSION pg_trgm;
```

## 2. Secrets

| Variable | Notes |
| --- | --- |
| `JWT_SECRET` | 48+ random bytes. Rotating it signs everyone out of their current access token (refresh tokens keep working). |
| `INTERNAL_API_KEY` | Same value for API and website; exempts server-side rendering from IP rate limits. |
| `DATABASE_URL` | Use TLS (`?sslmode=require`) for managed databases. |
| `CORS_ORIGINS` | Only needed if browsers call the API on a different origin. |
| `TRUST_PROXY_HOPS` | Number of proxies in front of the API (usually 1). Wrong values break IP rate limiting. |

Keep them in the platform's secret store, never in the repository.

## 3. Build and run the containers

```bash
docker build -f apps/api/Dockerfile -t yantramitra-api .
docker build -f apps/web/Dockerfile -t yantramitra-web \
  --build-arg API_INTERNAL_URL=http://api:4000 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://yantramitra.in .
```

The website bakes `API_INTERNAL_URL`, `NEXT_PUBLIC_*` and its Content Security Policy in at build time; rebuild when they change. The web container must listen on `0.0.0.0` (the image does); binding it to `127.0.0.1` behind a proxy that uses another host name breaks locale routing.

Run the API with `RUN_MIGRATIONS=true` for a single instance — it applies migrations and the idempotent catalogue seed before starting. With several replicas, run `docker run --rm yantramitra-api node_modules/.bin/prisma migrate deploy` as a release step instead.

`docker compose --profile full up --build` runs the same images locally (requires `JWT_SECRET` and `INTERNAL_API_KEY`).

## 4. One-time data

```bash
docker run --rm -e DATABASE_URL=... yantramitra-api node dist/cli/import-places.js IN    # gazetteer, re-run quarterly
docker run --rm -e DATABASE_URL=... -e ADMIN_MOBILE=... -e ADMIN_NAME=... -e ADMIN_PASSWORD=... \
  yantramitra-api node dist/cli/admin.js create
```

Never run `db:seed:dev` in production (it refuses to).

## 5. Android release

```bash
cd apps/mobile
npx eas build --platform android --profile production   # or: npx expo prebuild && cd android && ./gradlew bundleRelease
```

Set `EXPO_PUBLIC_API_URL=https://yantramitra.in/api/v1` for the build. The app requests foreground location only; background location is blocked in `app.json`.

## 6. Production checklist

- [ ] HTTPS everywhere; HSTS is sent by the website in production.
- [ ] `SWAGGER_ENABLED` unset (or behind authentication at the proxy).
- [ ] Nightly backups with `infrastructure/database/backup.sh`, copied off the server, and a restore tested.
- [ ] `SENTRY_DSN` set if error tracking is wanted.
- [ ] Map tiles: OpenStreetMap's public tile server is fine for a pilot. Above light usage, switch `NEXT_PUBLIC_MAP_TILE_URL` to a commercial or self-hosted tile provider.
- [ ] More than one API instance: move the in-memory IP rate limiter to Redis (login throttling is already in PostgreSQL).
- [ ] Marathi and Hindi copy reviewed by native speakers.
- [ ] A support phone number in `NEXT_PUBLIC_SUPPORT_PHONE` and a written password-reset procedure ([OPERATIONS.md](OPERATIONS.md)).

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, API end-to-end tests against PostGIS, and the Playwright suite on every push and pull request.
