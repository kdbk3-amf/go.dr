import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toPublicChamber } from "@/lib/projections";
import { createChamberSchema } from "@/lib/validators";
import { timeOfDay, parseQuery } from "@/lib/query";
import { paginationSchema } from "@/lib/validators";
import { normalizeLocationName } from "@/lib/locations";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

/**
 * GET /api/v1/doctors/me/chambers
 * A doctor lists their own chambers (active + inactive).
 * Ownership is derived from the authenticated doctor — the
 * doctorId is never read from the request body/query.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/doctors/me/chambers";
  try {
    const ctx = await authorize(req, ["doctor" as UserRole]);

    const { page, limit } = parseQuery(new URL(req.url).searchParams, paginationSchema);

    const doctor = await prisma.doctor.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
    if (!doctor) throw errors.notFound("Doctor profile not found");

    const where = { doctorId: doctor.id, deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.chamber.findMany({
        where,
        include: { hospital: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chamber.count({ where }),
    ]);

    logRequest("GET", path, 200, nowMs() - start);
    return ok(
      { chambers: items.map(toPublicChamber) },
      200,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

/**
 * POST /api/v1/doctors/me/chambers
 * A doctor creates their own chamber. doctorId is derived from the
 * authenticated user — clients cannot supply it.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/doctors/me/chambers";
  try {
    const ctx = await authorize(req, ["doctor" as UserRole]);

    const body = await req.json().catch(() => ({}));
    const parsed = createChamberSchema.safeParse(body);
    if (!parsed.success) throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;

    const doctor = await prisma.doctor.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
    if (!doctor) throw errors.notFound("Doctor profile not found");

    // Validate hospital reference if provided.
    if (d.hospitalId) {
      const hospital = await prisma.hospital.findFirst({
        where: { id: d.hospitalId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!hospital) throw errors.notFound("Hospital not found");
    }

    const startT = timeOfDay(d.startTime);
    const endT = timeOfDay(d.endTime);
    if (endT <= startT) throw errors.badRequest("End time must be after start time");

    const chamber = await prisma.chamber.create({
      data: {
        doctorId: doctor.id,
        hospitalId: d.hospitalId ?? null,
        chamberName: d.chamberName,
        address: d.address,
        city: d.city ? normalizeLocationName(d.city) : null,
        district: d.district ? normalizeLocationName(d.district) : null,
        visitingDays: d.visitingDays,
        startTime: startT,
        endTime: endT,
        slotDurationMinutes: d.slotDurationMinutes ?? 15,
        consultationFee: d.consultationFee ?? 0,
        isActive: d.isActive ?? true,
      },
      include: { hospital: { select: { id: true, name: true, slug: true } } },
    });

    logRequest("POST", path, 201, nowMs() - start);
    return ok({ chamber: toPublicChamber(chamber) }, 201);
  } catch (err) {
    logRequest("POST", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
