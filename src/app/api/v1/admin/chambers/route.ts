import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { authorize } from "@/lib/auth";
import { toPublicChamber } from "@/lib/projections";
import { parseQuery } from "@/lib/query";
import { paginationSchema } from "@/lib/validators";
import { normalizeLocationName } from "@/lib/locations";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

/**
 * GET /api/v1/admin/chambers — all chambers incl. inactive (admin).
 * Filters: doctorId, hospitalId, district, city, active. Pagination.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/admin/chambers";
  try {
    rateLimit(`${getClientIp(req)}:admin-chambers`, DEFAULT_RATE_LIMIT);
    await authorize(req, ["admin" as UserRole]);

    const sp = new URL(req.url).searchParams;
    const { page, limit } = parseQuery(sp, paginationSchema);
    const doctorId = sp.get("doctorId");
    const hospitalId = sp.get("hospitalId");
    const district = sp.get("district");
    const city = sp.get("city");
    const active = sp.get("active");

    const where = {
      deletedAt: null,
      ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
      ...(doctorId && /^\d+$/.test(doctorId) ? { doctorId: BigInt(doctorId) } : {}),
      ...(hospitalId && /^\d+$/.test(hospitalId) ? { hospitalId: BigInt(hospitalId) } : {}),
      ...(district ? { district: normalizeLocationName(district) } : {}),
      ...(city ? { city: normalizeLocationName(city) } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.chamber.findMany({
        where,
        include: {
          doctor: { select: { id: true, user: { select: { fullName: true } } } },
          hospital: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chamber.count({ where }),
    ]);

    logRequest("GET", path, 200, nowMs() - start);
    return ok(
      { chambers: items.map(toPublicChamber) },
      200,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
