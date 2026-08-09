# Go Dr — Project Memory

## Overview
Production-ready healthcare platform for Bangladesh. Stack: Next.js (App Router),
TypeScript, PostgreSQL, Prisma, Tailwind, Zod, REST API, JWT auth with refresh
tokens + RBAC (patient, doctor, admin).

## Phase Status
- **Phase 0 (Foundation):** COMPLETE — do not redo.
- **Phase 1 (Auth & Users):** COMPLETE — registration, login, logout, refresh
  token rotation, RBAC, profile routes, admin verify, 30 integration tests passing.
- **Phase 2 (Core Doctor/Specialty/Hospital/Chamber):** COMPLETE — specialties
  CRUD, doctor search (12 filters + 7 sort modes + pagination), hospitals CRUD,
  chambers CRUD with ownership enforcement, Bangladesh locations (divisions +
  districts), 33 Phase 2 tests passing (63 total).

## Key Commands
```bash
npm run dev              # Next.js dev server
npm run build            # production build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm test                 # vitest run (63 tests; test DB: godr_test)
npm run db:seed          # seed divisions, districts, specialties, hospitals, demo doctors
npm run prisma:deploy    # apply migrations (non-destructive)
npm run prisma:generate  # regenerate client after schema change
```

## Databases
- Dev DB: `godr` (PostgreSQL in `godr-db` Docker container, port 5432)
- Test DB: `godr_test` — reset leftover users before a run:
  `docker exec godr-db psql -U godr -d godr_test -c "DELETE FROM users WHERE phone != '01700000000';"`
- Env files: `.env` (dev), `.env.test` (test, gitignored).

## Architecture Notes
- Cookie handling: read from `req.cookies`, write to `res.cookies` (NOT
  `next/headers` `cookies()`). This keeps route handlers testable outside the
  Next.js request store — `cookies()` throws outside a real request scope.
- BigInt serialization: use `toJsonSafe()` / `toPublicUser()` projections; never
  return raw Prisma objects with `bigint` fields to the client.
- Refresh tokens: stored hashed in DB (`RefreshToken` model), rotated on use,
  revoked on logout. Reuse of a rotated token is rejected (401).
- Audit log `meta` field is `Json?` — convert any `bigint` to `.toString()`
  before storing (bigint is not `InputJsonValue`).
- Rate limiter: in-memory fixed-window, key `${ip}:${route}`. Auth endpoints
  5/min. Reset between tests via `__resetRateLimitStoreForTests()`.
- JWT `expiresIn`: pass as numeric seconds (not string) — `@types/jsonwebtoken@9`
  types reject plain strings.

## Path Aliases
- `@/*` → `./src/*`
- `@tests/*` → `./tests/*` (tsconfig + vitest)

## Test Helpers (`tests/helpers/api.ts`)
- `makeRequest(url, { method, body, token, cookie })` — builds NextRequest.
- `uniquePhone()` / `uniqueEmail()` — random suffixes (avoid cross-run collisions).
- `parseJson(res)`, `cleanupUsers(ids)`, `resetRateLimit()`.
- `createVerifiedDoctor(opts)` — creates a verified doctor + specialty link +
  active chamber; returns `{ user, doctorId, accessToken, specialtyId, chamberId }`.
- `cleanupHospitals(ids)`, `cleanupSpecialties(ids)`.

## Phase 2 Patterns
- **Soft-delete:** `Specialty`, `Hospital`, `Chamber` all have `deletedAt`. Deletes
  set `deletedAt = now()` + `isActive = false` rather than hard-deleting, to
  preserve referential integrity. All reads filter `deletedAt: null`.
- **Public vs admin listing:** public `GET` endpoints default to
  `isActive: true, deletedAt: null` and hide `deletedAt`; admin endpoints can list
  inactive rows and reveal more fields.
- **Doctor search:** resolves `specialty`/`specialtySlug`/`hospital` to id sets
  first, then builds a single Prisma `where` with chamber-location joins.
  `verified`/`available` default to `true` for public listings so unverified/
  inactive doctors are never discoverable publicly.
- **Ownership:** doctor chamber routes (`/doctors/me/chambers/[id]`) derive
  `doctorId` from the authenticated user and verify ownership server-side. A
  doctor operating on another doctor's chamber gets 404 (not 403) so existence
  isn't leaked.
- **Query parsing:** `parseQuery(sp, schema)` in `src/lib/query.ts` validates
  URLSearchParams with Zod and throws clean 400s. `timeOfDay("HH:mm")` converts
  to a `@db.Time` Date.
- **Projections:** `toPublicSpecialty`, `toPublicHospital`, `toPublicChamber`,
  `toDoctorCard` — all drop `deletedAt`/`passwordHash` and stringify `bigint` ids.
- **Audit logging:** all admin mutations (`SPECIALTY_CREATED/UPDATED/DELETED`,
  `HOSPITAL_*`, `CHAMBER_*`, `DOCTOR_STATUS_UPDATED`) write to `audit_logs`.
- **Pagination:** `limit` capped at 100; `page` starts at 1; meta returns
  `{ page, limit, total, totalPages }`.
- **Location normalization:** `normalizeLocationName()` trims + title-cases
  district/city/division for consistent matching regardless of client casing.
- **Bangla names:** `Doctor.nameBn` + `Hospital.nameBn` + `Specialty.nameBn`
  are editable via their respective update endpoints; public responses include
  them for bilingual UI support.

## Phase 2 Route Map
- `/api/v1/specialties` (GET), `/[param]` (GET — id-or-slug)
- `/api/v1/admin/specialties` (GET, POST), `/[id]` (PATCH, DELETE)
- `/api/v1/doctors` (GET — search), `/[id]` (GET — public profile)
- `/api/v1/doctors/me` (GET, PATCH), `/me/chambers` (GET, POST), `/me/chambers/[id]` (PATCH, DELETE)
- `/api/v1/admin/doctors` (GET), `/[id]` (GET, PATCH), `/[id]/verify` (PATCH)
- `/api/v1/hospitals` (GET), `/[param]` (GET — id-or-slug)
- `/api/v1/admin/hospitals` (GET, POST), `/[id]` (PATCH, DELETE)
- `/api/v1/chambers` (GET), `/api/v1/admin/chambers` (GET), `/[id]` (PATCH, DELETE)
- `/api/v1/divisions` (GET), `/api/v1/districts` (GET)

**Note:** Next.js App Router disallows sibling dynamic segments with different
param names (e.g. `[id]` + `[slug]`). Public single-resource lookups therefore
use a single `[param]` segment that dispatches on numeric id vs slug.

## Do NOT (Phase 2 boundary)
- Do NOT start Phase 3 (appointments, payments, SMS/OTP, reviews, prescriptions).
- Do NOT alter existing auth/schema/migrations (Phase 0/1) — only extend.
- Do NOT expose `phone`/`email`/`passwordHash`/`deletedAt` in public endpoints.
- Do NOT trust client-supplied `doctorId` for chamber mutations.
