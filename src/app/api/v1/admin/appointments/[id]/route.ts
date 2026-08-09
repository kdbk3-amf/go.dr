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
 * GET /api/v1/admin/appointments/[id]
 * ADMIN only. Returns any single appointment with relations.
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const start = nowMs();
    const path = "/api/v1/admin/appointments/[id]";
    try {
      await authorize(req, ["admin"]);

      const appt = await prisma.appointment.findFirst({
        where: { id: parseId(params.id) },
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
 * PATCH /api/v1/admin/appointments/[id]
 * ADMIN only. Admin may manage appointment status (confirm, complete,
 * no-show, cancel) when the transition is valid. Uses the same
 * centralized transition + cancellation rules as other actors.
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const start = nowMs();
    const path = "/api/v1/admin/appointments/[id]";
    try {
      const ctx = await authorize(req, ["admin"]);

      const appt = await prisma.appointment.findFirst({
        where: { id: parseId(params.id) },
      });
      if (!appt) throw errors.notFound("Appointment not found");

      const body = updateAppointmentStatusSchema.parse(await req.json().catch(() => ({})));
      const target = body.status as AppointmentStatus;

      if (!allowedTargetStatuses("admin").includes(target)) {
        throw errors.badRequest("Invalid target status");
      }

      if (target === "CANCELLED") {
        const apptStart = new Date(appt.appointmentDate);
        apptStart.setHours(appt.appointmentTime.getHours(), appt.appointmentTime.getMinutes(), 0, 0);
        assertCanCancel(appt.status, "admin", apptStart);
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
