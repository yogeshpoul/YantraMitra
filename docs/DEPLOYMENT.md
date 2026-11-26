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

## Alternative: everything on Vercel

Website, API and database all on Vercel: two Vercel projects from the same repository, plus a Neon Postgres database from the Vercel Marketplace (Neon supports PostGIS and `pg_trgm`). `apps/web/vercel.json` and `apps/api/vercel.json` hold the build settings; the API runs as one serverless function (`apps/api/api/index.js` → `src/serverless.ts`).

```
Browser / app ── yantramitra.vercel.app (web project, Next.js)
                     │  /api/v1/* rewrite + server-side calls with X-Internal-Key
                     └──────────────► yantramitra-api.vercel.app (api project, NestJS function) ── Neon Postgres + PostGIS
```

1. **Push the repository to GitHub.**
2. **API project.** Vercel → *Add New → Project* → import the repository → *Root Directory* `apps/api` (framework *Other*; leave build settings to `vercel.json`).
   Then *Storage → Create Database → Neon*, pick the region nearest India, and connect it to this project. That adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.
   Environment variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | 48+ random characters (`openssl rand -base64 48`) |
   | `INTERNAL_API_KEY` | random; the same value goes in the web project |
   | `TRUST_PROXY_HOPS` | `1` |
   | `DATABASE_POOL_MAX` | `3` |

   Deploy, then open `https://<api-project>.vercel.app/api/v1/health/ready`; it should return `{"status":"ok","database":"ok"}` once step 3 is done.
3. **Database, from your computer** (uses the *unpooled* URL, copied from the Neon page in Vercel):

   ```bash
   export DATABASE_URL='<DATABASE_URL_UNPOOLED>'        # PowerShell: $env:DATABASE_URL='...'
   pnpm db:migrate
   pnpm db:seed
   pnpm --filter @yantramitra/api places:import IN --states "Maharashtra"   # all of India needs ~600 MB
   ADMIN_MOBILE=98xxxxxxxx ADMIN_NAME="Your Name" ADMIN_PASSWORD='a long password' pnpm --filter @yantramitra/api admin create
   ```

   Neon's free plan has 0.5 GB: one or a few states fit (Maharashtra is about 26 MB); all of India needs a paid plan. Add states later by re-running the import with a longer `--states` list. Run `pnpm db:migrate` the same way after every release that adds a migration.
4. **Web project.** Import the same repository again → *Root Directory* `apps/web` (framework Next.js). Environment variables:

   | Variable | Value |
   | --- | --- |
   | `API_INTERNAL_URL` | `https://<api-project>.vercel.app` |
   | `INTERNAL_API_KEY` | same as the API |
   | `NEXT_PUBLIC_SITE_URL` | `https://<web-project>.vercel.app`, or your domain |
   | `NEXT_PUBLIC_SUPPORT_PHONE` | support number for password resets |

   These are built into the site, so **redeploy** after changing them (for example after adding a custom domain).
5. **Android app**: build with `EXPO_PUBLIC_API_URL=https://<web domain>/api/v1`.

Limits and checks specific to Vercel:

- **Plan**: Vercel's free Hobby plan is for non-commercial use; a public marketplace needs Pro.
- **IP rate limiting** is in memory, so on Vercel it applies per function instance only. Login throttling is in the database and still works. Add a Vercel Firewall rate-limit rule for `/api/v1/auth/*`.
- **Check after the first deploy** that rate limits see real visitor IPs through the web rewrite (several failed logins from one phone should be throttled, without affecting others).
- **Cold starts**: the first request after idle takes about one to two seconds longer.
- **Backups**: Neon keeps point-in-time history (length depends on plan); `backup.sh` with the unpooled URL also works from any machine.

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
