import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toPublicPatient } from "@/lib/projections";
import { updatePatientSchema } from "@/lib/validators";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/patients/me";
  try {
    const ctx = await authorize(req, ["patient" as UserRole]);

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      include: { patient: true },
    });
    if (!user || !user.patient) throw errors.notFound("Patient profile not found");

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ user: toPublicPatient(user) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/patients/me";
  try {
    const ctx = await authorize(req, ["patient" as UserRole]);

    const body = await req.json().catch(() => ({}));
    const parsed = updatePatientSchema.safeParse(body);
    if (!parsed.success) {
      throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const data = parsed.data;

    // Uniqueness guards for email/phone if changed.
    if (data.email || data.phone) {
      const clash = await prisma.user.findFirst({
        where: {
          id: { not: ctx.userId },
          OR: [
            ...(data.email ? [{ email: data.email }] : []),
            ...(data.phone ? [{ phone: data.phone }] : []),
          ],
          deletedAt: null,
        },
        select: { email: true, phone: true },
      });
      if (clash) {
        if (data.email && clash.email === data.email) throw errors.conflict("Email already in use");
        throw errors.conflict("Phone number already in use");
      }
    }

    const { fullName, email, phone, profilePhoto, ...patientFields } = data;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: ctx.userId },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(profilePhoto !== undefined ? { profilePhoto } : {}),
        },
        include: { patient: true },
      });
      if (user.patient && Object.keys(patientFields).length > 0) {
        await tx.patient.update({
          where: { userId: ctx.userId },
          data: patientFields,
        });
        return tx.user.findUnique({ where: { id: ctx.userId }, include: { patient: true } });
      }
      return user;
    });

    logRequest("PATCH", path, 200, nowMs() - start);
    return ok({ user: toPublicPatient(updated!) });
  } catch (err) {
    logRequest("PATCH", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
