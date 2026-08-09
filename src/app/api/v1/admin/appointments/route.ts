import { NextRequest } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { authorize } from "@/lib/auth";
import { appointmentListQuerySchema } from "@/lib/validators";
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
 * GET /api/v1/admin/appointments
 * ADMIN only. Lists appointments with filters (doctor, patient,
 * chamber, date, date range, status, upcoming) + pagination/sort.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/admin/appointments";
  try {
    await authorize(req, ["admin"]);

    const q = parseQuery(req.nextUrl.searchParams, appointmentListQuerySchema);

    const where: Prisma.AppointmentWhereInput = {};
    if (q.doctorId) where.doctorId = q.doctorId;
    if (q.patientId) where.patientId = q.patientId;
    if (q.chamberId) where.chamberId = q.chamberId;
    if (q.status) where.status = q.status;

    const dateFilter: Prisma.DateTimeFilter = {};
    let hasDateFilter = false;
    if (q.date) {
      dateFilter.equals = new Date(`${q.date}T00:00:00`);
      hasDateFilter = true;
    } else if (q.dateFrom || q.dateTo) {
      hasDateFilter = true;
      if (q.dateFrom) dateFilter.gte = new Date(`${q.dateFrom}T00:00:00`);
      if (q.dateTo) dateFilter.lte = new Date(`${q.dateTo}T23:59:59`);
    }
    if (q.upcoming === "true") {
      hasDateFilter = true;
      dateFilter.gte = new Date();
    }
    if (hasDateFilter) where.appointmentDate = dateFilter;

    const orderBy: Prisma.AppointmentOrderByWithRelationInput[] =
      q.sort === "date"
        ? [{ appointmentDate: "asc" }, { appointmentTime: "asc" }]
        : q.sort === "date_desc"
          ? [{ appointmentDate: "desc" }, { appointmentTime: "desc" }]
          : q.sort === "created"
            ? [{ createdAt: "asc" }]
            : q.sort === "created_desc"
              ? [{ createdAt: "desc" }]
              : [{ status: "asc" }];

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
