# Go Dr

A production-ready healthcare platform for **Bangladesh** that connects patients with verified doctors, hospitals and easy appointment booking.

> **Status:** Phase 0 — Foundation (project structure, database schema, configuration).
> Authentication, appointments, payments, SMS/OTP and frontend pages are implemented in later phases.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| API | REST via Next.js Route Handlers (planned) |
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

## Security Notes

- Passwords are hashed with **bcrypt** (configurable cost, default 12). Plaintext passwords are never stored.
- Secrets (`DATABASE_URL`, `JWT_SECRET`, etc.) live in `.env`, which is **gitignored** and never committed.
- `.env.example` contains only non-secret placeholders.
- The seed admin password is hashed before storage; change it in production.
- Production secrets must be supplied via environment variables / your host's secret manager.

## License

MIT
