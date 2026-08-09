import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toPublicSpecialty } from "@/lib/projections";
import { updateSpecialtySchema } from "@/lib/validators";
import { normalizeLocationName } from "@/lib/locations";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

/** PATCH /api/v1/admin/specialties/[id] — update a specialty (admin only). */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/admin/specialties/[id]";
  try {
    const ctx = await authorize(req, ["admin" as UserRole]);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid specialty id");
    const id = BigInt(params.id);

    const body = await req.json().catch(() => ({}));
    const parsed = updateSpecialtySchema.safeParse(body);
    if (!parsed.success) throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;

    const existing = await prisma.specialty.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw errors.notFound("Specialty not found");

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = normalizeLocationName(d.name);
    if (d.nameBn !== undefined) data.nameBn = d.nameBn;
    if (d.slug !== undefined) data.slug = d.slug;
    if (d.icon !== undefined) data.icon = d.icon;
    if (d.parentId !== undefined) data.parentId = d.parentId === null ? null : BigInt(d.parentId);
    if (d.isActive !== undefined) data.isActive = d.isActive;
    if (d.order !== undefined) data.order = d.order;

    if (data.name || data.slug) {
      const clash = await prisma.specialty.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(data.name ? [{ name: data.name as string }] : []),
            ...(data.slug ? [{ slug: data.slug as string }] : []),
          ],
          deletedAt: null,
        },
        select: { name: true, slug: true },
      });
      if (clash) {
        if (data.name && clash.name === data.name) throw errors.conflict("Specialty name already exists");
        throw errors.conflict("Slug already exists");
      }
    }

    const updated = await prisma.specialty.update({ where: { id }, data });

    await prisma.auditLog.create({
      data: { userId: ctx.userId, action: "SPECIALTY_UPDATED", entity: "Specialty", entityId: id, meta: { changed: Object.keys(data) } },
    });

    logRequest("PATCH", path, 200, nowMs() - start);
    return ok({ specialty: toPublicSpecialty(updated) });
  } catch (err) {
    logRequest("PATCH", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

/** DELETE /api/v1/admin/specialties/[id] — soft-delete + deactivate (admin only). */
export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/admin/specialties/[id]";
  try {
    const ctx = await authorize(req, ["admin" as UserRole]);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid specialty id");
    const id = BigInt(params.id);

    const existing = await prisma.specialty.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw errors.notFound("Specialty not found");

    // Soft-delete + deactivate to preserve referential integrity.
    await prisma.specialty.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

    await prisma.auditLog.create({
      data: { userId: ctx.userId, action: "SPECIALTY_DELETED", entity: "Specialty", entityId: id, meta: { name: existing.name } },
    });

    logRequest("DELETE", path, 200, nowMs() - start);
    return ok({ success: true });
  } catch (err) {
    logRequest("DELETE", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
