# YantraMitra — Database Design

PostgreSQL 16 + PostGIS, Prisma 7. UUID primary keys, `TIMESTAMPTZ` timestamps, `NUMERIC` prices.
Source of truth: `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations`.

## Tables

| Table | Notes |
| --- | --- |
| `users` | `mobile` E.164 unique, `password_hash` (Argon2id), `status`, `must_change_password`, `temp_password_expires_at`, `phone_verified_at` (reserved for OTP) |
| `sessions` | SHA-256 of refresh secret + previous hash for reuse detection |
| `login_throttles` | DB-backed login failure counters |
| `equipment_categories`, `equipment_types`, `operations` | Admin-managed, en/mr/hi names, unique `slug`, `is_active`, `sort_order` |
| `equipment_listings` | See below |
| `listing_operations` | Listing ↔ operation join |
| `equipment_images` | Reserved; unused in the MVP |
| `location_history` | Append-only record of current-location changes |
| `user_favorites` | Unique (user, listing) |
| `listing_reports` | Partial unique index: one open report per user and listing |
| `contact_events` | reveal / call_click / whatsapp_click |
| `admin_users` | 1:1 with `users`; created only by CLI |
| `admin_audit_logs` | Written in the same transaction as the admin action |
| `places` | Gazetteer (GeoNames or any other import) |

## Listing locations

| Column | Visibility | Purpose |
| --- | --- | --- |
| `home_location geography(Point,4326)` | owner only | Where the machine is normally kept |
| `current_location geography(Point,4326)` | owner only | Where it is now |
| `search_location geography(Point,4326)` | public projection | Equals current location when visibility is `exact`, otherwise snapped to a 0.01° grid |
| `current_locality/taluka/district/state/country_code` | public | Nearest gazetteer place |
| `*_label` | owner only | Owner's free text |
| `current_location_updated_at` | public | Freshness |

All geography columns have GiST indexes. Search uses `ST_DWithin` / `ST_Distance` on
`search_location`. `ST_MakePoint(longitude, latitude)` is only called from one helper
(`apps/api/src/common/geo.ts`).

Visibility: `exact`, `approximate` (default for current), `locality_only` (no coordinates
returned), `hidden` (home only; default for home).

## Constraints

- `price` is NULL exactly when `pricing_type = 'contact_for_price'`, otherwise > 0.
- `manufacturing_year` 1950–2100; positive minimums.
- `current_visibility <> 'hidden'`.
- The equipment type must belong to the category (composite foreign key).

## Status transitions

| From | Owner may set | Admin may set |
| --- | --- | --- |
| active | inactive, unavailable, deleted | suspended |
| inactive | active, unavailable, deleted | suspended |
| unavailable | active, inactive, deleted | suspended |
| suspended | deleted | active, inactive |
| deleted | — | — |

Owners can never leave `suspended` other than by deleting. Deletion is soft (`deleted_at`).
