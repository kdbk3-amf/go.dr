# Go Dr — Project Memory

## Overview
Production-ready healthcare platform for Bangladesh. Stack: Next.js (App Router),
TypeScript, PostgreSQL, Prisma, Tailwind, Zod, REST API, JWT auth with refresh
tokens + RBAC (patient, doctor, admin).

## Phase Status
- **Phase 0 (Foundation):** COMPLETE — do not redo.
- **Phase 1 (Auth & Users):** COMPLETE — registration, login, logout, refresh
  token rotation, RBAC, profile routes, admin verify, 30 integration tests passing.

## Key Commands
```bash
npm run dev              # Next.js dev server
npm run build            # production build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm test                 # vitest run (test DB: godr_test)
npm run db:migrate       # prisma migrate deploy
npm run db:generate      # prisma generate
npm run db:seed          # seed dev admin
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
