import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { toPublicHospital } from "@/lib/projections";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/v1/hospitals/[param]
 * Public single active hospital, looked up by numeric id OR slug.
 * A purely-numeric param is treated as an id; otherwise as a slug.
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { param: string } }) => {
  const start = nowMs();
  const path = "/api/v1/hospitals/[param]";
  try {
    rateLimit(`${getClientIp(req)}:hospitals`, DEFAULT_RATE_LIMIT);

    const isId = /^\d+$/.test(params.param);
    const hospital = isId
      ? await prisma.hospital.findFirst({ where: { id: BigInt(params.param), isActive: true, deletedAt: null } })
      : await prisma.hospital.findFirst({ where: { slug: params.param, isActive: true, deletedAt: null } });
    if (!hospital) throw errors.notFound("Hospital not found");

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ hospital: toPublicHospital(hospital) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
