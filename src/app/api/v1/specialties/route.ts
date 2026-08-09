import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { parseQuery } from "@/lib/query";
import { paginationSchema } from "@/lib/validators";
import { toPublicSpecialty } from "@/lib/projections";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/v1/specialties
 * Public list of active specialties, ordered by `order` then name.
 * Supports pagination via ?page & ?limit (max 100).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/specialties";
  try {
    rateLimit(`${getClientIp(req)}:specialties`, DEFAULT_RATE_LIMIT);

    const { page, limit } = parseQuery(new URL(req.url).searchParams, paginationSchema);

    const where = { isActive: true, deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.specialty.findMany({
        where,
        include: { parent: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.specialty.count({ where }),
    ]);

    logRequest("GET", path, 200, nowMs() - start);
    return ok(
      { specialties: items.map(toPublicSpecialty) },
      200,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
