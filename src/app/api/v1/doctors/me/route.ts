import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toPublicDoctor } from "@/lib/projections";
import { updateDoctorSchema } from "@/lib/validators";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/doctors/me";
  try {
    const ctx = await authorize(req, ["doctor" as UserRole]);

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      include: { doctor: true },
    });
    if (!user || !user.doctor) throw errors.notFound("Doctor profile not found");

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ user: toPublicDoctor(user) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/doctors/me";
  try {
    const ctx = await authorize(req, ["doctor" as UserRole]);

    const body = await req.json().catch(() => ({}));
    const parsed = updateDoctorSchema.safeParse(body);
    if (!parsed.success) {
      throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const data = parsed.data;

    // NOTE: isVerified is intentionally NOT in the schema — doctors
    // cannot self-verify. Only an admin can flip verification.

    // Uniqueness guards for email/phone/bmdc if changed.
    if (data.email || data.phone || data.bmdcRegNo) {
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
      if (data.bmdcRegNo) {
        const bmdcClash = await prisma.doctor.findFirst({
          where: { bmdcRegNo: data.bmdcRegNo, user: { id: { not: ctx.userId } } },
          select: { id: true },
        });
        if (bmdcClash) throw errors.conflict("BMDC registration number already in use");
      }
    }

    const { fullName, email, phone, profilePhoto, nameBn, ...doctorFields } = data;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: ctx.userId },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(profilePhoto !== undefined ? { profilePhoto } : {}),
        },
        include: { doctor: true },
      });
      const hasDoctorFields =
        user.doctor &&
        (Object.keys(doctorFields).length > 0 || nameBn !== undefined);
      if (user.doctor && hasDoctorFields) {
        await tx.doctor.update({
          where: { userId: ctx.userId },
          data: {
            ...(nameBn !== undefined ? { nameBn } : {}),
            ...doctorFields,
          },
        });
        return tx.user.findUnique({ where: { id: ctx.userId }, include: { doctor: true } });
      }
      return user;
    });

    logRequest("PATCH", path, 200, nowMs() - start);
    return ok({ user: toPublicDoctor(updated!) });
  } catch (err) {
    logRequest("PATCH", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
