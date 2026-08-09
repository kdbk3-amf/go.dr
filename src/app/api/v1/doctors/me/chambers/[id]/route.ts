import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toPublicChamber } from "@/lib/projections";
import { updateChamberSchema } from "@/lib/validators";
import { timeOfDay } from "@/lib/query";
import { normalizeLocationName } from "@/lib/locations";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

/**
 * PATCH /api/v1/doctors/me/chambers/[id]
 * A doctor updates their own chamber. The chamber MUST belong to the
 * authenticated doctor — ownership is verified server-side, so a
 * doctor can never modify another doctor's chamber.
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/doctors/me/chambers/[id]";
  try {
    const ctx = await authorize(req, ["doctor" as UserRole]);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid chamber id");
    const chamberId = BigInt(params.id);

    const doctor = await prisma.doctor.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
    if (!doctor) throw errors.notFound("Doctor profile not found");

    // Ownership check: chamber must belong to this doctor.
    const chamber = await prisma.chamber.findFirst({
      where: { id: chamberId, doctorId: doctor.id, deletedAt: null },
    });
    if (!chamber) throw errors.notFound("Chamber not found");

    const body = await req.json().catch(() => ({}));
    const parsed = updateChamberSchema.safeParse(body);
    if (!parsed.success) throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;

    if (d.hospitalId !== undefined && d.hospitalId !== null) {
      const hospital = await prisma.hospital.findFirst({
        where: { id: d.hospitalId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!hospital) throw errors.notFound("Hospital not found");
    }

    const data: Record<string, unknown> = {};
    if (d.hospitalId !== undefined) data.hospitalId = d.hospitalId;
    if (d.chamberName !== undefined) data.chamberName = d.chamberName;
    if (d.address !== undefined) data.address = d.address;
    if (d.city !== undefined) data.city = d.city ? normalizeLocationName(d.city) : null;
    if (d.district !== undefined) data.district = d.district ? normalizeLocationName(d.district) : null;
    if (d.visitingDays !== undefined) data.visitingDays = d.visitingDays;
    if (d.startTime !== undefined) data.startTime = timeOfDay(d.startTime);
    if (d.endTime !== undefined) data.endTime = timeOfDay(d.endTime);
    if (d.slotDurationMinutes !== undefined) data.slotDurationMinutes = d.slotDurationMinutes;
    if (d.consultationFee !== undefined) data.consultationFee = d.consultationFee;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    // Validate time ordering if either changed.
    const newStart = data.startTime ? (data.startTime as Date) : chamber.startTime;
    const newEnd = data.endTime ? (data.endTime as Date) : chamber.endTime;
    if (newEnd <= newStart) throw errors.badRequest("End time must be after start time");

    const updated = await prisma.chamber.update({
      where: { id: chamberId },
      data,
      include: { hospital: { select: { id: true, name: true, slug: true } } },
    });

    logRequest("PATCH", path, 200, nowMs() - start);
    return ok({ chamber: toPublicChamber(updated) });
  } catch (err) {
    logRequest("PATCH", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

/**
 * DELETE /api/v1/doctors/me/chambers/[id]
 * A doctor soft-deletes (deactivates) their own chamber. Ownership
 * is verified server-side.
 */
export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/doctors/me/chambers/[id]";
  try {
    const ctx = await authorize(req, ["doctor" as UserRole]);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid chamber id");
    const chamberId = BigInt(params.id);

    const doctor = await prisma.doctor.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
    if (!doctor) throw errors.notFound("Doctor profile not found");

    const chamber = await prisma.chamber.findFirst({
      where: { id: chamberId, doctorId: doctor.id, deletedAt: null },
    });
    if (!chamber) throw errors.notFound("Chamber not found");

    // Soft-delete + deactivate.
    await prisma.chamber.update({ where: { id: chamberId }, data: { deletedAt: new Date(), isActive: false } });

    logRequest("DELETE", path, 200, nowMs() - start);
    return ok({ success: true });
  } catch (err) {
    logRequest("DELETE", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
