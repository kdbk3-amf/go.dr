-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ALTER COLUMN "appointmentNumber" SET DEFAULT 'APT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('appointment_number_seq')::text, 6, '0');

-- CreateIndex
CREATE INDEX "appointments_chamberId_appointmentDate_appointmentTime_idx" ON "appointments"("chamberId", "appointmentDate", "appointmentTime");

-- ============================================================
-- Double-booking protection (Phase 3)
-- ============================================================
-- A PARTIAL UNIQUE INDEX prevents two appointments from ever
-- occupying the same (chamber, date, time) slot simultaneously.
-- Cancelled slots are excluded so they can be re-booked. This is
-- the database-level guard that backs the application-level check
-- inside the booking transaction; under a race it throws P2002,
-- which the route handler maps to HTTP 409 Conflict.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_active_slot_unique_key"
  ON "appointments" ("chamberId", "appointmentDate", "appointmentTime")
  WHERE "status" <> 'CANCELLED';
