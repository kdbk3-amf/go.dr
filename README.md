# Go Dr

A production-ready healthcare platform for **Bangladesh** that connects patients with verified doctors, hospitals and easy appointment booking.

> **Status:** Phase 2 — Core Doctor, Specialty, Hospital & Chamber System (complete).
> Phase 0 (foundation), Phase 1 (auth & users), and Phase 2 (doctor/specialty/hospital/chamber/search) are implemented.
> Appointments, payments, SMS/OTP, notifications, reviews, prescriptions, medical records and the frontend UI are planned for later phases.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| API | REST via Next.js Route Handlers |
| Database | PostgreSQL 15+ |
| ORM | Prisma 5 |
| Validation | Zod |
| Auth | JWT (access + refresh), bcrypt password hashing, RBAC (patient/doctor/admin) |

## Project Structure

```
go.dr/
├── prisma/
│   ├── schema.prisma          # Prisma schema (single source of truth for DB)
│   ├── seed.ts                # Seed: specialties, BD hospitals, dev admin
│   └── migrations/            # Prisma migrations (incl. appointment_number trigger)
├── src/
│   ├── app/                   # Next.js App Router (layout, page, globals.css)
│   ├── config/
│   │   └── env.ts             # Zod-validated environment configuration
│   └── lib/
│       ├── prisma.ts          # Prisma client singleton
│       ├── password.ts        # bcrypt hash/verify helpers
│       └── generated/         # Prisma generated client (do not edit)
├── .env.example               # Environment template (no real secrets)
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── package.json
```

## Database Schema (Phase 0)

13 tables, all inconsistencies from the legacy SQL schema fixed:

| Table | Purpose |
| --- | --- |
| `users` | Accounts with role (admin/doctor/patient), hashed password, verification flags, soft-delete |
| `specialties` | Medical specialties (EN + Bangla name), self-referencing parent for sub-specialties |
| `patients` | Patient profiles (DOB, gender, blood group, emergency contact) |
| `doctors` | Doctor profiles incl. **BMDC registration number**, qualification, fee, bio |
| `doctor_specialties` | Many-to-many between doctors and specialties |
| `hospitals` | Hospitals with BD division/district/city + geo coordinates |
| `chambers` | Doctor chambers with visiting days, time range, slot duration |
| `appointments` | Bookings with **auto-generated appointment number**, status, payment fields |
| `reviews` | Patient ratings (1–5) tied to completed appointments |
| `notifications` | In-app notifications per user |
| `refresh_tokens` | Hashed, revocable JWT refresh tokens |
| `otp_codes` | OTP codes for registration/login/password reset |
| `audit_logs` | Security audit trail of sensitive actions |

Key design points:

- **Appointment numbers** auto-generated as `APT-YYYY-NNNNNN` via a PostgreSQL sequence + trigger (see `prisma/migrations/0001_appointment_number`).
- **Soft-delete** (`deletedAt`) on user-facing tables.
- **Indexes** on every hot lookup column (role, phone, email, FKs, status, dates).
- **Foreign keys** with `ON DELETE CASCADE` (or `SET NULL` for audit logs).
- **Timestamps** (`createdAt`, `updatedAt`) everywhere; `updatedAt` maintained by Prisma.

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (local, via Docker, or managed)
- npm 10+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL` — your Postgres connection string
- `JWT_SECRET` — a long random string (e.g. `openssl rand -base64 64`)

### 3. Start PostgreSQL (optional, via Docker)

```bash
docker run --name godr-db -e POSTGRES_USER=godr \
  -e POSTGRES_PASSWORD=godr_dev_password -e POSTGRES_DB=godr \
  -p 5432:5432 -d postgres:15
```

### 4. Run migrations + seed

```bash
npm run db:setup
```

This runs `prisma migrate deploy` followed by the seed script, which creates:
- 15 medical specialties (with Bangla names)
- 4 sample Dhaka hospitals
- 1 development admin account (password hashed with bcrypt)

### 5. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 — the home page shows foundation status and DB connectivity.

## Useful Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run prisma:validate` | Validate Prisma schema |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Create + apply a new migration (dev) |
| `npm run prisma:deploy` | Apply pending migrations (prod) |
| `npm run db:seed` | Run the seed script |
| `npm run db:setup` | Migrate + seed in one command |
| `npm run prisma:studio` | Open Prisma Studio (DB browser) |
| `npm test` | Run the integration test suite (63 tests) |

## API Reference

All API routes are prefixed `/api/v1`. Public `GET` endpoints require no
authentication; mutation endpoints require a `Bearer` access token and the
correct role. Responses use the envelope `{ success, data, meta }`.

### Authentication (Phase 1)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | – | Register as patient or doctor |
| POST | `/api/v1/auth/login` | – | Login (phone or email + password) |
| POST | `/api/v1/auth/refresh` | cookie | Rotate refresh token |
| POST | `/api/v1/auth/logout` | cookie | Revoke refresh token, clear cookie |
| GET | `/api/v1/auth/me` | bearer | Current user profile |
| GET/PATCH | `/api/v1/patients/me` | patient | Get/update own patient profile |
| GET/PATCH | `/api/v1/doctors/me` | doctor | Get/update own doctor profile |
| GET | `/api/v1/admin/users` | admin | Paginated user list |
| GET | `/api/v1/admin/doctors` | admin | Paginated doctor list |
| GET/PATCH | `/api/v1/admin/doctors/[id]` | admin | View/activate a doctor |
| PATCH | `/api/v1/admin/doctors/[id]/verify` | admin | Verify/unverify a doctor |

### Specialties (Phase 2)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/specialties` | – | List active specialties (paginated) |
| GET | `/api/v1/specialties/[id-or-slug]` | – | Specialty by numeric id or slug |
| GET | `/api/v1/admin/specialties` | admin | All specialties (incl. inactive) |
| POST | `/api/v1/admin/specialties` | admin | Create specialty |
| PATCH | `/api/v1/admin/specialties/[id]` | admin | Update specialty |
| DELETE | `/api/v1/admin/specialties/[id]` | admin | Soft-delete specialty |

### Doctors & Search (Phase 2)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/doctors` | – | Search verified active doctors |
| GET | `/api/v1/doctors/[id]` | – | Public doctor profile |

Doctor search filters (`GET /api/v1/doctors`):

| Param | Example | Notes |
| --- | --- | --- |
| `name` | `?name=Arif` | Full-name contains (case-insensitive) |
| `specialty` | `?specialty=cardiology` | Name or slug |
| `specialtySlug` | `?specialtySlug=cardiology` | Exact slug |
| `district` | `?district=Chattogram` | Via chamber location |
| `city` | `?city=Chattogram` | Via chamber location |
| `hospital` | `?hospital=square` | Name or slug |
| `minExperience` | `?minExperience=10` | Years |
| `maxFee` | `?maxFee=1000` | Consultation fee upper bound |
| `minFee` | `?minFee=500` | Consultation fee lower bound |
| `verified` | `?verified=true` | Default `true` (public only) |
| `available` | `?available=true` | Default `true` (public only) |
| `sort` | `?sort=fee_desc` | `experience`, `experience_desc`, `fee`, `fee_desc`, `name`, `name_desc`, `newest` |
| `page`, `limit` | `?page=1&limit=20` | Pagination (limit max 100) |

Example:

```
GET /api/v1/doctors?specialty=cardiology&district=Chattogram&page=1&limit=20
```

### Hospitals (Phase 2)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/hospitals` | – | Search hospitals (name, district, city, division) |
| GET | `/api/v1/hospitals/[id-or-slug]` | – | Hospital by numeric id or slug |
| GET/POST | `/api/v1/admin/hospitals` | admin | List all / create |
| PATCH/DELETE | `/api/v1/admin/hospitals/[id]` | admin | Update / soft-delete |

### Chambers (Phase 2)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/chambers` | – | Public active chambers (filter: doctorId, hospitalId, district, city) |
| GET | `/api/v1/doctors/me/chambers` | doctor | List own chambers |
| POST | `/api/v1/doctors/me/chambers` | doctor | Create own chamber |
| PATCH/DELETE | `/api/v1/doctors/me/chambers/[id]` | doctor | Update/deactivate own chamber (ownership enforced) |
| GET | `/api/v1/admin/chambers` | admin | All chambers |
| PATCH/DELETE | `/api/v1/admin/chambers/[id]` | admin | Update/soft-delete any chamber |

### Locations (Phase 2)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/divisions` | – | List divisions + nested districts |
| GET | `/api/v1/districts` | – | List districts (optional `?division=slug`) |

## Authentication

- **Access token:** JWT (15 min), sent as `Authorization: Bearer <token>`.
- **Refresh token:** JWT (7 days), stored in an httpOnly, secure, sameSite cookie; rotated on each refresh with reuse detection.
- **RBAC:** roles `patient`, `doctor`, `admin`. Mutation endpoints enforce role + ownership.
- Doctors cannot self-verify, cannot change `isVerified`, and cannot edit another doctor's chamber. Ownership is derived from the authenticated user, never from client-supplied ids.

## Workflow

1. Admin seeds reference data (specialties, hospitals, divisions/districts).
2. A doctor registers and fills their profile (qualification, BMDC, fee, bio, Bangla name) via `PATCH /api/v1/doctors/me`.
3. An admin verifies the doctor via `PATCH /api/v1/admin/doctors/[id]/verify`.
4. The verified doctor creates chambers via `POST /api/v1/doctors/me/chambers`.
5. Patients search verified doctors via `GET /api/v1/doctors` and view profiles via `GET /api/v1/doctors/[id]`.

## Database Migrations & Seed

```bash
# Apply migrations (non-destructive, additive only)
npm run prisma:deploy

# Seed reference data + demo doctors (demo doctors are unverified & labelled)
npm run db:seed

# Or both
npm run db:setup
```

Seed creates: 8 divisions, 50 districts, 18 specialties, 8 hospitals, 3 demo
doctors (clearly labelled `[DEMO]` and **never verified**) with chambers, and
one development admin account. Demo doctors cannot be mistaken for real
practitioners.

## Development

```bash
npm run dev          # start dev server on :3000
npm test             # 63 integration tests (auth + Phase 2)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
```

## Security Notes

- Passwords are hashed with **bcrypt** (configurable cost, default 12). Plaintext passwords are never stored.
- Secrets (`DATABASE_URL`, `JWT_SECRET`, etc.) live in `.env`, which is **gitignored** and never committed.
- `.env.example` contains only non-secret placeholders.
- The seed admin password is hashed before storage; change it in production.
- Production secrets must be supplied via environment variables / your host's secret manager.
- Public doctor/chamber endpoints never expose `passwordHash`, `phone`, `email`, or `deletedAt`.
- Doctor chamber ownership is verified server-side; client-supplied `doctorId` is ignored for mutations.
- All input is validated with Zod; pagination `limit` is capped at 100 to prevent unrestricted queries.
- Admin mutations are audit-logged in `audit_logs`.

## License

MIT
