import { NextRequest } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { createAppointmentSchema, appointmentListQuerySchema } from "@/lib/validators";
import { bookAppointment } from "@/lib/appointments/booking";
import { toPublicAppointment } from "@/lib/projections";
import { parseQuery } from "@/lib/query";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

const APPOINTMENT_INCLUDE = {
  patient: { select: { user: { select: { fullName: true } } } },
  doctor: {
    select: { nameBn: true, user: { select: { fullName: true, profilePhoto: true } } },
  },
  chamber: { select: { chamberName: true, address: true, city: true, district: true } },
} as const;

/**
 * POST /api/v1/appointments
 * Authenticated PATIENT only. Creates an appointment for the calling
 * patient. doctorId, fee, appointmentNumber, patientId, and serialNo
 * are all server-derived and never trusted from the request body.
 *
 * Double-booking is prevented at both the application level (check
 * inside the transaction) and the database level (partial unique
 * index) → HTTP 409 on conflict.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/appointments";
  try {
    const ctx = await authorize(req, ["patient"]);

    const body = createAppointmentSchema.parse(await req.json().catch(() => ({})));

    // Resolve the patient profile for the authenticated user.
    const patient = await prisma.patient.findFirst({
      where: { userId: ctx.userId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw errors.notFound("Patient profile not found");

    const { appointment } = await bookAppointment({
      patientId: patient.id,
      chamberId: body.chamberId,
      date: body.date,
      time: body.time,
      patientProblem: body.patientProblem,
    });

    // Re-fetch with relations for the confirmation payload.
    const full = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!full) throw errors.internal();

    logRequest("POST", path, 201, nowMs() - start);
    return ok({ appointment: toPublicAppointment(full) }, 201);
  } catch (err) {
    logRequest(
      "POST",
      path,
      err instanceof Error && "status" in err ? (err as { status: number }).status : 500,
      nowMs() - start,
    );
    throw err;
  }
});

/**
 * GET /api/v1/appointments
 * ADMIN only. Lists appointments with filters (doctor, patient,
 * chamber, date, date range, status, upcoming) + pagination/sort.
 * Patients and doctors may never use this to access other users'
 * appointments.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/appointments";
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
        include: APPOINTMENT_INCLUDE,
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
