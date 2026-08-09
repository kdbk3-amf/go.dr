import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { parseQuery } from "@/lib/query";
import { hospitalSearchSchema } from "@/lib/validators";
import { toPublicHospital } from "@/lib/projections";
import { normalizeLocationName } from "@/lib/locations";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/v1/hospitals
 * Public search for active hospitals. Filters: name, district, city,
 * division, active (default true). Pagination via ?page & ?limit.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/hospitals";
  try {
    rateLimit(`${getClientIp(req)}:hospitals`, DEFAULT_RATE_LIMIT);

    const q = parseQuery(new URL(req.url).searchParams, hospitalSearchSchema);

    const where = {
      deletedAt: null,
      // Public listing defaults to active hospitals only.
      isActive: q.active === "false" ? false : true,
      ...(q.name ? { name: { contains: q.name, mode: "insensitive" as const } } : {}),
      ...(q.district ? { district: normalizeLocationName(q.district) } : {}),
      ...(q.city ? { city: normalizeLocationName(q.city) } : {}),
      ...(q.division ? { division: normalizeLocationName(q.division) } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.hospital.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.hospital.count({ where }),
    ]);

    logRequest("GET", path, 200, nowMs() - start);
    return ok(
      { hospitals: items.map(toPublicHospital) },
      200,
      { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    );
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
