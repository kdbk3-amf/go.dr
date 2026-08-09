import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { toJsonSafe } from "@/lib/serialize";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

/** GET /api/v1/divisions — public list of active divisions. */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/divisions";
  try {
    rateLimit(`${getClientIp(req)}:divisions`, DEFAULT_RATE_LIMIT);

    const divisions = await prisma.division.findMany({
      where: { isActive: true },
      include: {
        districts: {
          where: { isActive: true },
          select: { id: true, name: true, nameBn: true, slug: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ divisions: toJsonSafe(divisions) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
