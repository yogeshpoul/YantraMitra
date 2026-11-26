# YantraMitra — API Specification

Base path `/api/v1`. Interactive OpenAPI: `/api/docs` (disabled in production unless `SWAGGER_ENABLED=true`).

## Conventions

- Auth: `Authorization: Bearer <access token>`.
- Clients send `X-Client-Type: web | native`. Cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`) **require** this header, which blocks cross-site form posts.
- Pagination: `?page=1&pageSize=20` → `{ items, page, pageSize, total, totalPages }`.
- Errors: `{ statusCode, code, message, details?, requestId }`. `code` is stable and is what clients localise.

## Endpoints

| Method | Path | Access |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | public, rate limited |
| POST | `/auth/refresh` | refresh token |
| POST | `/auth/logout` | refresh token or bearer |
| POST | `/auth/change-password` | user |
| GET | `/auth/me` | user |
| GET, PATCH | `/users/me` | user |
| GET | `/users/me/listings`, `/users/me/listings/:id`, `/users/me/favorites` | user |
| GET | `/categories`, `/categories/:id/types`, `/operations` | public |
| GET | `/equipment`, `/equipment/nearby`, `/equipment/:id` | public |
| POST | `/equipment` | user |
| PATCH, DELETE | `/equipment/:id` | owner |
| PATCH | `/equipment/:id/status`, `/equipment/:id/location` | owner |
| POST, DELETE | `/equipment/:id/favorite` | user |
| GET | `/equipment/:id/contact` | user, rate limited |
| POST | `/equipment/:id/contact-events`, `/equipment/:id/reports` | user |
| GET | `/locations/config`, `/locations/search`, `/locations/reverse`, `/locations/places/:slug`, `/locations/localities` | public |
| GET | `/admin/dashboard`, `/admin/listings`, `/admin/users`, `/admin/reports`, `/admin/audit-logs` | admin |
| PATCH | `/admin/listings/:id/status`, `/admin/users/:id/status`, `/admin/reports/:id` | admin |
| POST | `/admin/users/:id/password-reset` | admin |
| GET, POST, PATCH | `/admin/categories`, `/admin/equipment-types`, `/admin/operations` | admin |
| GET | `/health`, `/health/ready` | public |

## Search parameters (`GET /equipment`)

`q`, `category`, `type`, `operation` (slugs), `place` (gazetteer slug), `lat`+`lng`, `radiusKm` (1–500),
`pricingType`, `priceMin`, `priceMax`, `operatorTerm`, `sort` (`nearest|recent|price_asc|price_desc`), `page`, `pageSize`.

`GET /equipment/nearby` is the same search but `lat` and `lng` are mandatory.
If `place` resolves to a district or state the search is by administrative area; otherwise it is a radius around the place.
With no location parameter the search covers every location. There is no default city.

## Contact

`GET /equipment/:id/contact` returns `{ ownerName, phone, whatsappUrl }` only if the listing is active, contact is
enabled and the owner account is active; each reveal is recorded. Errors: `LISTING_NOT_ACTIVE`, `CONTACT_DISABLED`, `OWNER_UNAVAILABLE`.
