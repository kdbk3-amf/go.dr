import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toPublicSpecialty } from "@/lib/projections";
import { createSpecialtySchema } from "@/lib/validators";
import { slugify, normalizeLocationName } from "@/lib/locations";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

/** GET /api/v1/admin/specialties — all specialties incl. inactive (admin only). */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/admin/specialties";
  try {
    rateLimit(`${getClientIp(req)}:admin-specialties`, DEFAULT_RATE_LIMIT);
    await authorize(req, ["admin" as UserRole]);

    const items = await prisma.specialty.findMany({
      where: { deletedAt: null },
      include: { parent: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    logRequest("GET", path, 200, nowMs() - start);
    return ok({ specialties: items.map(toPublicSpecialty) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

/** POST /api/v1/admin/specialties — create a specialty (admin only). */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/admin/specialties";
  try {
    rateLimit(`${getClientIp(req)}:admin-specialties`, DEFAULT_RATE_LIMIT);
    const ctx = await authorize(req, ["admin" as UserRole]);

    const body = await req.json().catch(() => ({}));
    const parsed = createSpecialtySchema.safeParse(body);
    if (!parsed.success) throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;

    const slug = d.slug ?? slugify(d.name);
    const name = normalizeLocationName(d.name);

    const clash = await prisma.specialty.findFirst({
      where: { OR: [{ name }, { slug }], deletedAt: null },
      select: { name: true, slug: true },
    });
    if (clash) {
      if (clash.name === name) throw errors.conflict("Specialty name already exists");
      throw errors.conflict("Slug already exists");
    }

    const specialty = await prisma.specialty.create({
      data: {
        name,
        nameBn: d.nameBn,
        slug,
        icon: d.icon,
        parentId: d.parentId ? BigInt(d.parentId) : null,
        isActive: d.isActive ?? true,
        order: d.order ?? 0,
      },
    });

    await prisma.auditLog.create({
      data: { userId: ctx.userId, action: "SPECIALTY_CREATED", entity: "Specialty", entityId: specialty.id, meta: { name, slug } },
    });

    logRequest("POST", path, 201, nowMs() - start);
    return ok({ specialty: toPublicSpecialty(specialty) }, 201);
  } catch (err) {
    logRequest("POST", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
