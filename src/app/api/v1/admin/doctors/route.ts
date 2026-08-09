import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { authorize } from "@/lib/auth";
import { toJsonSafe } from "@/lib/serialize";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/admin/doctors";
  try {
    rateLimit(`${getClientIp(req)}:admin-doctors`, DEFAULT_RATE_LIMIT);
    const ctx = await authorize(req, ["admin" as UserRole]);

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
    const verifiedParam = url.searchParams.get("verified");

    const where = {
      deletedAt: null,
      ...(verifiedParam === "true" ? { isVerified: true } : verifiedParam === "false" ? { isVerified: false } : {}),
    };

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true, uuid: true, fullName: true, email: true, phone: true, role: true,
              isVerified: true, isActive: true, createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.doctor.count({ where }),
    ]);

    logRequest("GET", path, 200, nowMs() - start);
    void ctx;
    return ok({ doctors: toJsonSafe(doctors) }, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
