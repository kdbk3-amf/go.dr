import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { authorize } from "@/lib/auth";
import { toPublicHospital } from "@/lib/projections";
import { updateHospitalSchema } from "@/lib/validators";
import { normalizeLocationName } from "@/lib/locations";
import { logRequest, nowMs } from "@/lib/logger";
import type { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

/** PATCH /api/v1/admin/hospitals/[id] — update a hospital (admin only). */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/admin/hospitals/[id]";
  try {
    const ctx = await authorize(req, ["admin" as UserRole]);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid hospital id");
    const id = BigInt(params.id);

    const body = await req.json().catch(() => ({}));
    const parsed = updateHospitalSchema.safeParse(body);
    if (!parsed.success) throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;

    const existing = await prisma.hospital.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw errors.notFound("Hospital not found");

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name.trim();
    if (d.nameBn !== undefined) data.nameBn = d.nameBn;
    if (d.slug !== undefined) data.slug = d.slug;
    if (d.address !== undefined) data.address = d.address;
    if (d.city !== undefined) data.city = d.city ? normalizeLocationName(d.city) : null;
    if (d.district !== undefined) data.district = d.district ? normalizeLocationName(d.district) : null;
    if (d.division !== undefined) data.division = d.division ? normalizeLocationName(d.division) : null;
    if (d.phone !== undefined) data.phone = d.phone;
    if (d.email !== undefined) data.email = d.email && d.email.length > 0 ? d.email : null;
    if (d.website !== undefined) data.website = d.website && d.website.length > 0 ? d.website : null;
    if (d.latitude !== undefined) data.latitude = d.latitude;
    if (d.longitude !== undefined) data.longitude = d.longitude;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    if (data.name || data.slug) {
      const clash = await prisma.hospital.findFirst({
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
        if (data.name && clash.name === data.name) throw errors.conflict("Hospital name already exists");
        throw errors.conflict("Slug already exists");
      }
    }

    const updated = await prisma.hospital.update({ where: { id }, data });

    await prisma.auditLog.create({
      data: { userId: ctx.userId, action: "HOSPITAL_UPDATED", entity: "Hospital", entityId: id, meta: { changed: Object.keys(data) } },
    });

    logRequest("PATCH", path, 200, nowMs() - start);
    return ok({ hospital: toPublicHospital(updated) });
  } catch (err) {
    logRequest("PATCH", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});

/** DELETE /api/v1/admin/hospitals/[id] — soft-delete + deactivate (admin only). */
export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const start = nowMs();
  const path = "/api/v1/admin/hospitals/[id]";
  try {
    const ctx = await authorize(req, ["admin" as UserRole]);
    if (!/^\d+$/.test(params.id)) throw errors.badRequest("Invalid hospital id");
    const id = BigInt(params.id);

    const existing = await prisma.hospital.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw errors.notFound("Hospital not found");

    await prisma.hospital.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

    await prisma.auditLog.create({
      data: { userId: ctx.userId, action: "HOSPITAL_DELETED", entity: "Hospital", entityId: id, meta: { name: existing.name } },
    });

    logRequest("DELETE", path, 200, nowMs() - start);
    return ok({ success: true });
  } catch (err) {
    logRequest("DELETE", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
