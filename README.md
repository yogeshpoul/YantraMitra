# YantraMitra

**The right equipment. Right when you need it.**

A peer-to-peer marketplace that connects farmers who need agricultural machinery with people who own it, anywhere in India. Any registered user can list equipment, keep its current location up to date, and be contacted directly. YantraMitra does not rent equipment, take bookings or handle payments.

| App | Stack | Path |
| --- | --- | --- |
| API | NestJS 12, Prisma 7, PostgreSQL 16 + PostGIS | `apps/api` |
| Website and admin | Next.js 16 (App Router), Tailwind CSS 4, next-intl | `apps/web` |
| Android | Expo 58, Expo Router, React Native | `apps/mobile` |
| Shared | Types, Zod validation, API client, translations, illustrations | `packages/*` |

Languages: Marathi (default), Hindi, English. Design and decisions: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md), [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md), [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md).

## Run it locally

No paid service or API key is needed. Requires Node 22.12+ and pnpm 9.

```bash
pnpm install
pnpm build:packages
```

**1. Database** — either:

```bash
docker compose up -d db          # PostGIS on localhost:5433
```

or, on Windows without Docker, a project-local PostGIS on port 55432 (copies an installed PostgreSQL 16; never modifies it):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\devdb.ps1 setup    # later: start | stop
```

**2. API**

```bash
cp apps/api/.env.example apps/api/.env       # set DATABASE_URL and a JWT_SECRET (32+ characters)
pnpm db:migrate
pnpm db:seed                                  # equipment categories, types and operations
pnpm --filter @yantramitra/api places:import IN   # ~575k villages, towns, districts and PIN codes (GeoNames, ~90 s)
pnpm --filter @yantramitra/api db:seed:dev    # DEVELOPMENT ONLY: 10 sample listings across India
pnpm dev:api                                  # http://localhost:4000, docs at /api/docs
```

**3. Website**

```bash
cp apps/web/.env.example apps/web/.env.local  # INTERNAL_API_KEY must match the API's
pnpm dev:web                                  # http://localhost:3000
```

**4. Android app**

```bash
cp apps/mobile/.env.example apps/mobile/.env  # EXPO_PUBLIC_API_URL; the emulator reaches your PC at 10.0.2.2
pnpm dev:mobile                               # then press "a", or scan the QR code with Expo Go
```

**5. An administrator** — there is deliberately no web sign-up for admins:

```bash
ADMIN_MOBILE=98xxxxxxxx ADMIN_NAME="Your Name" ADMIN_PASSWORD='a long password' pnpm --filter @yantramitra/api admin create
```

Then log in on the website and open `/admin`.

### Development-only features

| Feature | Where | Production |
| --- | --- | --- |
| Sample listings and owners (`db:seed:dev`) | `apps/api/src/cli/seed-dev.ts` | Refuses to run when `NODE_ENV=production` |
| `scripts/devdb.ps1` trust-auth database | local machine | Use a managed or password-protected PostgreSQL |
| Swagger UI | `/api/docs` | Off unless `SWAGGER_ENABLED=true` |
| OpenStreetMap public tiles, public Nominatim | maps and optional search | Follow their usage policies or self-host |

There is no fake OTP anywhere. Login is mobile number + password; forgotten passwords are reset by an administrator ([docs/OPERATIONS.md](docs/OPERATIONS.md)).

## Tests

```bash
pnpm lint && pnpm typecheck
pnpm test             # unit tests + API end-to-end tests against the yantramitra_test database
pnpm test:e2e         # Playwright, against a running API (with dev seed data) and website
```

Optional browser suites: set `E2E_ADMIN_MOBILE` / `E2E_ADMIN_PASSWORD` (an admin created with the CLI) for the admin tests, and `MOBILE_WEB_URL` (a served `expo export --platform web`) for the Android app smoke test.

## Configuration

Every secret and URL is an environment variable. See `apps/api/.env.example`, `apps/web/.env.example`, `apps/mobile/.env.example`. Optional integrations, each off by default: Google Maps (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `LOCATION_PROVIDER=google`), Nominatim (`LOCATION_PROVIDER=nominatim`), Sentry (`SENTRY_DSN`).

## Deployment

[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Operations (admins, password resets, backups, moderation): [docs/OPERATIONS.md](docs/OPERATIONS.md). Current status: [docs/STATUS.md](docs/STATUS.md).

Place names © [GeoNames](https://www.geonames.org/) (CC BY 4.0). Map data © OpenStreetMap contributors.
