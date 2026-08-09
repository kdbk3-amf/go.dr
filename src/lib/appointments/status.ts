/**
 * Appointment status transitions & cancellation rules (Phase 3).
 *
 * All status-change logic is centralized here so every endpoint
 * (patient, doctor, admin) applies identical rules. This prevents
 * invalid transitions regardless of who initiates the change.
 */
import { errors } from "@/lib/errors";
import type { AppointmentStatus, UserRole } from "@/lib/generated/prisma";

/**
 * Minimum lead time (hours) before an appointment before a PATIENT
 * may cancel it. Configurable — change here, not scattered in routes.
 * 0 means patients may cancel up until the appointment time.
 */
export const PATIENT_CANCELLATION_WINDOW_HOURS = 2;

/**
 * Allowed forward transitions per status. Any transition not listed
 * here is rejected. Terminal states (COMPLETED, CANCELLED, NO_SHOW)
 * cannot transition to anything.
 */
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** True when `to` is a valid forward transition from `from`. */
export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validate + apply a status transition. Throws clean 400s on invalid
 * transitions. Returns the prisma data to merge into an update.
 */
export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (from === to) throw errors.badRequest("Appointment is already in this status");
  if (!canTransition(from, to)) {
    throw errors.badRequest(`Cannot change appointment status from ${from} to ${to}`);
  }
}

/**
 * Centralized cancellation logic. Enforces business rules that apply
 * regardless of actor, then actor-specific rules.
 *
 * @param current     current appointment status
 * @param actor       role of the user cancelling
 * @param apptStart   the appointment's start Date (date + time)
 * @param now         current time (injectable for tests)
 */
export function assertCanCancel(
  current: AppointmentStatus,
  actor: UserRole,
  apptStart: Date,
  now: Date = new Date(),
): void {
  if (current === "CANCELLED") {
    throw errors.badRequest("Appointment is already cancelled");
  }
  if (current === "COMPLETED") {
    throw errors.badRequest("Cannot cancel a completed appointment");
  }
  if (current === "NO_SHOW") {
    throw errors.badRequest("Cannot cancel a no-show appointment");
  }
  // Only PENDING / CONFIRMED can be cancelled from here.

  // Patients are subject to the configurable cancellation window.
  if (actor === "patient") {
    const leadMs = apptStart.getTime() - now.getTime();
    const windowMs = PATIENT_CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000;
    if (leadMs < windowMs) {
      throw errors.badRequest(
        `Appointments can only be cancelled at least ${PATIENT_CANCELLATION_WINDOW_HOURS} hours before the scheduled time`,
      );
    }
  }
  // Doctors and admins may cancel PENDING/CONFIRMED without a window.
}

/**
 * Which statuses an actor may set on an appointment. Used to scope
 * the doctor/admin status-update endpoints.
 */
export function allowedTargetStatuses(actor: UserRole): AppointmentStatus[] {
  if (actor === "patient") {
    // Patients may only cancel — never confirm/complete/no-show.
    return ["CANCELLED"];
  }
  if (actor === "doctor") {
    return ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"];
  }
  // Admin may set any forward-valid status.
  return ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED", "PENDING"];
}
