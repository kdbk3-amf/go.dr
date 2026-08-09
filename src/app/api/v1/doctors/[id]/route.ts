import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { toDoctorCard } from "@/lib/projections";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/v1/doctors/[id]
 * Public profile of a single verified, active doctor. Returns
 * specialties + active chambers (summary). Unverified/inactive
 * doctors return 404 so they are never discoverable publicly.
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/doctors/[id]";
  try {
    rateLimit(`${getClientIp(req)}:doctors`, DEFAULT_RATE_LIMIT);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid doctor id");

    const doctor = await prisma.doctor.findFirst({
      where: { id: BigInt(params.id), isVerified: true, isAvailable: true, deletedAt: null },
      include: {
        user: { select: { fullName: true, profilePhoto: true } },
        specialties: {
          include: {
            specialty: { select: { id: true, name: true, nameBn: true, slug: true, icon: true } },
          },
        },
        chambers: {
          where: { isActive: true, deletedAt: null },
          select: { id: true, chamberName: true, city: true, district: true, hospitalId: true },
        },
      },
    });
    if (!doctor) throw errors.notFound("Doctor not found");

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ doctor: toDoctorCard(doctor) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
