import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { cancelAppointmentSchema } from "@/lib/validators";
import { assertCanCancel } from "@/lib/appointments/status";
import { toPublicAppointment } from "@/lib/projections";
import { logRequest, nowMs } from "@/lib/logger";

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
 * GET /api/v1/appointments/[id]
 * Authenticated PATIENT. Returns the appointment only if it belongs
 * to the calling patient. Otherwise 404 (existence not leaked).
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const start = nowMs();
    const path = "/api/v1/appointments/[id]";
    try {
      const ctx = await authorize(req, ["patient"]);

      const patient = await prisma.patient.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        select: { id: true },
      });
      if (!patient) throw errors.notFound("Patient profile not found");

      const appt = await prisma.appointment.findFirst({
        where: { id: parseId(params.id), patientId: patient.id },
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
 * PATCH /api/v1/appointments/[id]
 * Authenticated PATIENT. Patients may ONLY cancel their own
 * appointment (never change doctor/chamber/date/time/status to
 * anything else). Enforces the configurable cancellation window
 * and centralized cancellation rules.
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const start = nowMs();
    const path = "/api/v1/appointments/[id]";
    try {
      const ctx = await authorize(req, ["patient"]);

      const patient = await prisma.patient.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        select: { id: true },
      });
      if (!patient) throw errors.notFound("Patient profile not found");

      const appt = await prisma.appointment.findFirst({
        where: { id: parseId(params.id), patientId: patient.id },
      });
      if (!appt) throw errors.notFound("Appointment not found");

      const body = cancelAppointmentSchema.parse(await req.json().catch(() => ({})));

      // Reconstruct the appointment start Date for the cancellation window.
      const apptStart = new Date(appt.appointmentDate);
      apptStart.setHours(appt.appointmentTime.getHours(), appt.appointmentTime.getMinutes(), 0, 0);

      assertCanCancel(appt.status, "patient", apptStart);

      const updated = await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          status: "CANCELLED",
          cancelReason: body.cancelReason ?? null,
          cancelledBy: ctx.userId,
          cancelledAt: new Date(),
        },
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
