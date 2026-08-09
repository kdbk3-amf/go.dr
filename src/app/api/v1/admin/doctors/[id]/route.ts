import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toJsonSafe } from "@/lib/serialize";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

const updateDoctorAdminSchema = z.object({
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(), // toggles the underlying user.isActive
});

/**
 * GET /api/v1/admin/doctors/[id] — admin view of a single doctor
 * (including unverified/inactive). Returns full admin-safe fields.
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/admin/doctors/[id]";
  try {
    await authorize(req, ["admin" as UserRole]);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid doctor id");

    const doctor = await prisma.doctor.findFirst({
      where: { id: BigInt(params.id), deletedAt: null },
      include: {
        user: {
          select: {
            id: true, uuid: true, fullName: true, email: true, phone: true, role: true,
            isVerified: true, isActive: true, createdAt: true,
          },
        },
        specialties: {
          include: { specialty: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    if (!doctor) throw errors.notFound("Doctor not found");

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ doctor: toJsonSafe(doctor) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

/**
 * PATCH /api/v1/admin/doctors/[id] — admin updates a doctor's
 * availability / account-active status. Verification is handled
 * by the dedicated /verify endpoint; this route only manages
 * availability and account activation.
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/admin/doctors/[id]";
  try {
    const ctx = await authorize(req, ["admin" as UserRole]);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid doctor id");
    const id = BigInt(params.id);

    const body = await req.json().catch(() => ({}));
    const parsed = updateDoctorAdminSchema.safeParse(body);
    if (!parsed.success) throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;

    const existing = await prisma.doctor.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { id: true } } },
    });
    if (!existing) throw errors.notFound("Doctor not found");

    const doctorData: Record<string, unknown> = {};
    if (d.isAvailable !== undefined) doctorData.isAvailable = d.isAvailable;

    const updated = await prisma.$transaction(async (tx) => {
      if (d.isActive !== undefined && existing.user) {
        await tx.user.update({ where: { id: existing.user.id }, data: { isActive: d.isActive } });
      }
      if (Object.keys(doctorData).length > 0) {
        return tx.doctor.update({ where: { id }, data: doctorData, include: { user: { select: { id: true, uuid: true, fullName: true, isActive: true } } } });
      }
      return tx.doctor.findUnique({ where: { id }, include: { user: { select: { id: true, uuid: true, fullName: true, isActive: true } } } });
    });

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        action: "DOCTOR_STATUS_UPDATED",
        entity: "Doctor",
        entityId: id,
        meta: {
          ...(d.isAvailable !== undefined ? { isAvailable: d.isAvailable } : {}),
          ...(d.isActive !== undefined ? { userIsActive: d.isActive } : {}),
        },
      },
    });

    logRequest("PATCH", path, 200, nowMs() - start);
    return ok({ doctor: toJsonSafe(updated) });
  } catch (err) {
    logRequest("PATCH", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
