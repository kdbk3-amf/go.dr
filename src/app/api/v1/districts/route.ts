import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { toJsonSafe } from "@/lib/serialize";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/v1/districts — public list of active districts.
 * Optional ?division=slug filter.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/districts";
  try {
    rateLimit(`${getClientIp(req)}:districts`, DEFAULT_RATE_LIMIT);

    const divisionSlug = new URL(req.url).searchParams.get("division");
    const where = {
      isActive: true,
      ...(divisionSlug ? { division: { slug: divisionSlug, isActive: true } } : {}),
    };

    const districts = await prisma.district.findMany({
      where,
      include: { division: { select: { id: true, name: true, slug: true } } },
      orderBy: { name: "asc" },
    });

    if (districts.length === 0 && divisionSlug) {
      const div = await prisma.division.findUnique({ where: { slug: divisionSlug } });
      if (!div) throw errors.notFound("Division not found");
    }

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ districts: toJsonSafe(districts) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
