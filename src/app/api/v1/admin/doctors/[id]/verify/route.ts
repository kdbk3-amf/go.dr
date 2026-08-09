import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toJsonSafe } from "@/lib/serialize";
import { verifyDoctorSchema } from "@/lib/validators";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/admin/doctors/[id]/verify";
  try {
    const ctx = await authorize(req, ["admin" as UserRole]);

    const doctorId = BigInt(params.id);
    if (Number.isNaN(Number(params.id))) throw errors.badRequest("Invalid doctor id");

    const body = await req.json().catch(() => ({}));
    const parsed = verifyDoctorSchema.safeParse(body);
    if (!parsed.success) {
      throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, deletedAt: null },
      include: { user: { select: { id: true, uuid: true, fullName: true, email: true, phone: true } } },
    });
    if (!doctor) throw errors.notFound("Doctor not found");

    if (doctor.isVerified === parsed.data.isVerified) {
      logRequest("PATCH", path, 200, nowMs() - start);
      return ok({ doctor: toJsonSafe(doctor) });
    }

    const updated = await prisma.doctor.update({
      where: { id: doctorId },
      data: { isVerified: parsed.data.isVerified },
      include: { user: { select: { id: true, uuid: true, fullName: true, email: true, phone: true } } },
    });

    // Audit the verification action.
    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        action: parsed.data.isVerified ? "DOCTOR_VERIFIED" : "DOCTOR_UNVERIFIED",
        entity: "Doctor",
        entityId: doctorId,
        meta: { doctorUserId: doctor.userId.toString() },
      },
    });

    logRequest("PATCH", path, 200, nowMs() - start);
    return ok({ doctor: toJsonSafe(updated) });
  } catch (err) {
    logRequest("PATCH", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
