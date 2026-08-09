import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { toPublicSpecialty } from "@/lib/projections";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/v1/specialties/[param]
 * Public single active specialty, looked up by numeric id OR slug.
 * A purely-numeric param is treated as an id; otherwise as a slug.
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { param: string } }) => {
  const start = nowMs();
  const path = "/api/v1/specialties/[param]";
  try {
    rateLimit(`${getClientIp(req)}:specialties`, DEFAULT_RATE_LIMIT);

    const isId = /^\d+$/.test(params.param);
    const specialty = isId
      ? await prisma.specialty.findFirst({
          where: { id: BigInt(params.param), isActive: true, deletedAt: null },
          include: { parent: { select: { id: true, name: true, slug: true } } },
        })
      : await prisma.specialty.findFirst({
          where: { slug: params.param, isActive: true, deletedAt: null },
          include: { parent: { select: { id: true, name: true, slug: true } } },
        });
    if (!specialty) throw errors.notFound("Specialty not found");

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ specialty: toPublicSpecialty(specialty) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
