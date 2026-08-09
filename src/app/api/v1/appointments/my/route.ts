import { NextRequest } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { myAppointmentsQuerySchema } from "@/lib/validators";
import { toPublicAppointment } from "@/lib/projections";
import { parseQuery } from "@/lib/query";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

const APPT_INCLUDE = {
  patient: { select: { user: { select: { fullName: true } } } },
  doctor: { select: { nameBn: true, user: { select: { fullName: true, profilePhoto: true } } } },
  chamber: { select: { chamberName: true, address: true, city: true, district: true } },
} as const;

/**
 * GET /api/v1/appointments/my
 * Authenticated PATIENT only. Lists the calling patient's own
 * appointments with optional status + upcoming filters, pagination
 * and sorting. Never exposes another patient's appointments.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/appointments/my";
  try {
    const ctx = await authorize(req, ["patient"]);

    const patient = await prisma.patient.findFirst({
      where: { userId: ctx.userId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw errors.notFound("Patient profile not found");

    const q = parseQuery(req.nextUrl.searchParams, myAppointmentsQuerySchema);

    const where: Prisma.AppointmentWhereInput = { patientId: patient.id };
    if (q.status) where.status = q.status;
    if (q.upcoming === "true") {
      where.appointmentDate = { gte: new Date() };
    } else if (q.upcoming === "false") {
      where.appointmentDate = { lt: new Date() };
    }

    const orderBy: Prisma.AppointmentOrderByWithRelationInput[] =
      q.sort === "date"
        ? [{ appointmentDate: "asc" }, { appointmentTime: "asc" }]
        : q.sort === "created"
          ? [{ createdAt: "asc" }]
          : q.sort === "created_desc"
            ? [{ createdAt: "desc" }]
            : [{ appointmentDate: "desc" }, { appointmentTime: "desc" }];

    const [total, items] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include: APPT_INCLUDE,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);

    logRequest("GET", path, 200, nowMs() - start);
    return ok(
      { appointments: items.map(toPublicAppointment) },
      200,
      { pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } },
    );
  } catch (err) {
    logRequest(
      "GET",
      path,
      err instanceof Error && "status" in err ? (err as { status: number }).status : 500,
      nowMs() - start,
    );
    throw err;
  }
});
