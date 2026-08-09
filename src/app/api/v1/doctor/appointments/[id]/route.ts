import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { updateAppointmentStatusSchema } from "@/lib/validators";
import { assertTransition, assertCanCancel, allowedTargetStatuses } from "@/lib/appointments/status";
import { toPublicAppointment } from "@/lib/projections";
import { logRequest, nowMs } from "@/lib/logger";
import type { AppointmentStatus } from "@/lib/generated/prisma";

export const runtime = "nodejs";

const APPT_INCLUDE = {
  patient: { select: { user: { select: { fullName: true } } } },
  doctor: { select: { nameBn: true, user: { select: { fullName: true, profilePhoto: true } } } },
  chamber: { select: { chamberName: true, address: true, city: true, district: true } },
} as const;

function parseId(param: string): bigint {
  if (!/^\d+$/.test(param)) throw errors.badRequest("Invalid appointment id");
  return BigInt(param);
}

/**
 * GET /api/v1/doctor/appointments/[id]
 * Authenticated DOCTOR. Returns the appointment only if it belongs
 * to the calling doctor. Otherwise 404 (existence not leaked).
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const start = nowMs();
    const path = "/api/v1/doctor/appointments/[id]";
    try {
      const ctx = await authorize(req, ["doctor"]);

      const doctor = await prisma.doctor.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        select: { id: true },
      });
      if (!doctor) throw errors.notFound("Doctor profile not found");

      const appt = await prisma.appointment.findFirst({
        where: { id: parseId(params.id), doctorId: doctor.id },
        include: APPT_INCLUDE,
      });
      if (!appt) throw errors.notFound("Appointment not found");

      logRequest("GET", path, 200, nowMs() - start);
      return ok({ appointment: toPublicAppointment(appt) });
    } catch (err) {
      logRequest(
        "GET",
        path,
        err instanceof Error && "status" in err ? (err as { status: number }).status : 500,
        nowMs() - start,
      );
      throw err;
    }
  },
);

/**
 * PATCH /api/v1/doctor/appointments/[id]
 * Authenticated DOCTOR. Doctor may confirm, complete, mark no-show,
 * or cancel (when allowed) appointments belonging to them. Status
 * transitions are validated centrally; invalid transitions return 400.
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const start = nowMs();
    const path = "/api/v1/doctor/appointments/[id]";
    try {
      const ctx = await authorize(req, ["doctor"]);

      const doctor = await prisma.doctor.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        select: { id: true },
      });
      if (!doctor) throw errors.notFound("Doctor profile not found");

      const appt = await prisma.appointment.findFirst({
        where: { id: parseId(params.id), doctorId: doctor.id },
      });
      if (!appt) throw errors.notFound("Appointment not found");

      const body = updateAppointmentStatusSchema.parse(await req.json().catch(() => ({})));
      const target = body.status as AppointmentStatus;

      if (!allowedTargetStatuses("doctor").includes(target)) {
        throw errors.forbidden("Doctors may only confirm, complete, mark no-show, or cancel");
      }

      // Cancellation goes through the centralized cancellation rules.
      // Doctors have no cancellation window (unlike patients).
      if (target === "CANCELLED") {
        const apptStart = new Date(appt.appointmentDate);
        apptStart.setHours(appt.appointmentTime.getHours(), appt.appointmentTime.getMinutes(), 0, 0);
        assertCanCancel(appt.status, "doctor", apptStart);
      } else {
        assertTransition(appt.status, target);
      }

      const data: Record<string, unknown> = { status: target };
      if (target === "CANCELLED") {
        data.cancelReason = body.cancelReason ?? null;
        data.cancelledBy = ctx.userId;
        data.cancelledAt = new Date();
      }
      if (body.doctorNotes !== undefined) data.doctorNotes = body.doctorNotes;

      const updated = await prisma.appointment.update({
        where: { id: appt.id },
        data,
        include: APPT_INCLUDE,
      });

      logRequest("PATCH", path, 200, nowMs() - start);
      return ok({ appointment: toPublicAppointment(updated) });
    } catch (err) {
      logRequest(
        "PATCH",
        path,
        err instanceof Error && "status" in err ? (err as { status: number }).status : 500,
        nowMs() - start,
      );
      throw err;
    }
  },
);
