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
- **Phase 3 (Appointment & Slot Booking):** COMPLETE — slot generation, transaction-
  safe booking with double-booking prevention (app + DB partial unique index),
  centralized status transitions + cancellation rules, patient/doctor/admin
  appointment routes with RBAC + ownership, 35 Phase 3 tests passing (98 total).

## Key Commands
```bash
npm run dev              # Next.js dev server
npm run build            # production build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm test                 # vitest run (98 tests; test DB: godr_test)
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
- Phase 3 helpers: `createChamberForDoctor(doctorId, opts)` (custom visiting
  schedule), `cleanupAppointments(ids)`, `cleanupChambers(ids)`,
  `futureDateOnWeekday(weekday)` (0=Sun..6=Sat, guaranteed future + past the
  patient cancellation window).

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

## Phase 3 Patterns
- **Slot generation** (`src/lib/appointments/slots.ts`): builds a slot grid from
  the chamber's `visitingDays` (comma-separated lowercase day abbrevs
  `sun,mon,tue,wed,thu,fri,sat`), `startTime`/`endTime` (`@db.Time`), and
  `slotDurationMinutes`. Past slots and slots already booked by a non-cancelled
  appointment are marked `available: false`. Inactive chambers and
  unverified/unavailable doctors → 404; non-visiting days → empty list.
- **Transaction-safe booking** (`src/lib/appointments/booking.ts`): runs inside
  `prisma.$transaction`. `doctorId`, `consultationFee`, `appointmentNumber`
  (`APT-YYYY-NNNNNN` via DB sequence), `patientId`, and `serialNo` are all
  server-derived — never trusted from the request body. Double-booking is
  guarded at two layers: an app-level active-appointment check inside the tx,
  AND the DB partial unique index `appointments_active_slot_unique_key` on
  `(chamberId, appointmentDate, appointmentTime, serialNo) WHERE status NOT IN
  cancelled`. A `Promise.all` race resolves to one 201 + one 409.
- **Status transitions** (`src/lib/appointments/status.ts`): centralized
  `ALLOWED_TRANSITIONS` map + `assertTransition` (throws 400 on invalid) +
  `assertCanCancel` (configurable patient cancellation window; doctors/admins
  have no window). `COMPLETED`/`NO_SHOW`/`CANCELLED` are terminal. Patients may
  ONLY cancel their own appointment; they can never change
  doctor/chamber/date/time/status. Doctors confirm/complete/no-show/cancel;
  admins manage any status. `cancelledBy`/`cancelledAt`/`cancelReason` recorded
  on cancel.
- **Ownership:** patient & doctor appointment routes derive the patient/doctor
  id from the authenticated user and filter `where: { ..., patientId|doctorId }`.
  Cross-access returns 404 (existence not leaked), matching Phase 2 chamber
  ownership semantics.
- **Projection:** `toPublicAppointment` stringifies `bigint` ids / `Decimal` fee
  and exposes only safe relation fields (patient/doctor/chamber names). It keeps
  `patientProblem`/`doctorNotes` since these are only ever returned to a party of
  the appointment (the owning patient, the owning doctor, or an admin) — never
  in a fully public listing.
- **Compound orderBy:** Prisma 5.22 requires compound `orderBy` as an array,
  e.g. `[{ appointmentDate: "asc" }, { appointmentTime: "asc" }]` (typed
  `Prisma.AppointmentOrderByWithRelationInput[]`). Single-field orderBy can
  still be a plain object.

## Phase 3 Route Map
- `/api/v1/chambers/[chamberId]/slots` (GET — public, ?date=)
- `/api/v1/appointments` (POST — patient booking; GET — admin list)
- `/api/v1/appointments/my` (GET — patient own list)
- `/api/v1/appointments/[id]` (GET — patient view; PATCH — patient cancel)
- `/api/v1/doctor/appointments` (GET — doctor own list)
- `/api/v1/doctor/appointments/[id]` (GET — doctor view; PATCH — confirm/complete/no-show/cancel)
- `/api/v1/admin/appointments` (GET — admin list)
- `/api/v1/admin/appointments/[id]` (GET — admin view; PATCH — manage status)

## Do NOT (Phase 3 boundary)
- Do NOT start Phase 4 (payments, SMS/OTP, notifications, reviews, prescriptions,
  medical records) until explicitly approved.
- Do NOT alter existing auth/schema/migrations (Phase 0/1/2) — only extend.
- Do NOT expose `phone`/`email`/`passwordHash`/`deletedAt`/`patientProblem` PII
  in public endpoints.
- Do NOT trust client-supplied `doctorId`/`fee`/`appointmentNumber`/`serialNo`
  for appointment creation — all server-derived.
- Do NOT seed fake appointments against unverified demo doctors (would require
  fake patients / medical records). The booking flow is covered by tests.
