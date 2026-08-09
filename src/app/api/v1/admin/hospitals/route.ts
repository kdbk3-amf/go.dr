import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toPublicHospital } from "@/lib/projections";
import { createHospitalSchema } from "@/lib/validators";
import { slugify, normalizeLocationName } from "@/lib/locations";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

/**
 * GET /api/v1/admin/hospitals — all hospitals incl. inactive (admin).
 * Supports ?active=true|false and ?district filter + pagination.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/admin/hospitals";
  try {
    rateLimit(`${getClientIp(req)}:admin-hospitals`, DEFAULT_RATE_LIMIT);
    await authorize(req, ["admin" as UserRole]);

    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? "20")));
    const active = sp.get("active");
    const district = sp.get("district");

    const where = {
      deletedAt: null,
      ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
      ...(district ? { district: normalizeLocationName(district) } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.hospital.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * limit, take: limit }),
      prisma.hospital.count({ where }),
    ]);

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ hospitals: items.map(toPublicHospital) }, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

/** POST /api/v1/admin/hospitals — create a hospital (admin only). */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/admin/hospitals";
  try {
    rateLimit(`${getClientIp(req)}:admin-hospitals`, DEFAULT_RATE_LIMIT);
    const ctx = await authorize(req, ["admin" as UserRole]);

    const body = await req.json().catch(() => ({}));
    const parsed = createHospitalSchema.safeParse(body);
    if (!parsed.success) throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;

    const slug = d.slug ?? slugify(d.name);
    const name = d.name.trim();

    const clash = await prisma.hospital.findFirst({
      where: { OR: [{ name }, { slug }], deletedAt: null },
      select: { name: true, slug: true },
    });
    if (clash) {
      if (clash.name === name) throw errors.conflict("Hospital name already exists");
      throw errors.conflict("Slug already exists");
    }

    const hospital = await prisma.hospital.create({
      data: {
        name,
        nameBn: d.nameBn,
        slug,
        address: d.address,
        city: d.city ? normalizeLocationName(d.city) : null,
        district: d.district ? normalizeLocationName(d.district) : null,
        division: d.division ? normalizeLocationName(d.division) : null,
        phone: d.phone,
        email: d.email && d.email.length > 0 ? d.email : null,
        website: d.website && d.website.length > 0 ? d.website : null,
        latitude: d.latitude,
        longitude: d.longitude,
        isActive: d.isActive ?? true,
      },
    });

    await prisma.auditLog.create({
      data: { userId: ctx.userId, action: "HOSPITAL_CREATED", entity: "Hospital", entityId: hospital.id, meta: { name, slug } },
    });

    logRequest("POST", path, 201, nowMs() - start);
    return ok({ hospital: toPublicHospital(hospital) }, 201);
  } catch (err) {
    logRequest("POST", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
