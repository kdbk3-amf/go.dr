import { NextRequest } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { parseQuery } from "@/lib/query";
import { doctorSearchSchema } from "@/lib/validators";
import { toDoctorCard } from "@/lib/projections";
import { normalizeLocationName } from "@/lib/locations";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

const SORT_MAP: Record<string, Prisma.DoctorOrderByWithRelationInput> = {
  experience: { experienceYears: "asc" },
  experience_desc: { experienceYears: "desc" },
  fee: { consultationFee: "asc" },
  fee_desc: { consultationFee: "desc" },
  name: { user: { fullName: "asc" } },
  name_desc: { user: { fullName: "desc" } },
  newest: { createdAt: "desc" },
};

/**
 * GET /api/v1/doctors
 * Public search for verified, active doctors. Supports filters:
 * name, specialty (name or slug), specialtySlug, district, city,
 * hospital, minExperience, maxFee, minFee, verified, available,
 * pagination (?page, ?limit max 100) and sorting (?sort).
 *
 * Only public fields are returned — never passwordHash, phone, or
 * email. Unverified/inactive doctors are excluded by default.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/doctors";
  try {
    rateLimit(`${getClientIp(req)}:doctors`, DEFAULT_RATE_LIMIT);

    const q = parseQuery(new URL(req.url).searchParams, doctorSearchSchema);

    // Resolve specialty filter to a specialty id set so we can join
    // through doctor_specialties efficiently.
    let specialtyIds: bigint[] | undefined;
    if (q.specialty || q.specialtySlug) {
      const term = (q.specialtySlug ?? q.specialty ?? "").toLowerCase();
      const matches = await prisma.specialty.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [{ slug: term }, { name: { contains: q.specialty ?? "", mode: "insensitive" } }],
          ...(q.specialtySlug ? { slug: q.specialtySlug } : {}),
        },
        select: { id: true },
      });
      specialtyIds = matches.map((s) => s.id);
      if (specialtyIds.length === 0) {
        // No matching specialty -> empty result (don't error).
        logRequest("GET", path, 200, nowMs() - start);
        return ok({ doctors: [] }, 200, { page: q.page, limit: q.limit, total: 0, totalPages: 0 });
      }
    }

    // Resolve hospital filter (name or slug) to a hospital id set.
    let hospitalIds: bigint[] | undefined;
    if (q.hospital) {
      const term = q.hospital.toLowerCase();
      const matches = await prisma.hospital.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [{ slug: term }, { name: { contains: q.hospital, mode: "insensitive" } }],
        },
        select: { id: true },
      });
      hospitalIds = matches.map((h) => h.id);
      if (hospitalIds.length === 0) {
        logRequest("GET", path, 200, nowMs() - start);
        return ok({ doctors: [] }, 200, { page: q.page, limit: q.limit, total: 0, totalPages: 0 });
      }
    }

    const where: Prisma.DoctorWhereInput = {
      deletedAt: null,
      // Public listing only shows verified & active doctors.
      isVerified: q.verified === "false" ? false : true,
      isAvailable: q.available === "false" ? false : true,
      ...(q.minExperience !== undefined ? { experienceYears: { gte: q.minExperience } } : {}),
      ...(q.minFee !== undefined || q.maxFee !== undefined
        ? {
            consultationFee: {
              ...(q.minFee !== undefined ? { gte: new Prisma.Decimal(q.minFee) } : {}),
              ...(q.maxFee !== undefined ? { lte: new Prisma.Decimal(q.maxFee) } : {}),
            },
          }
        : {}),
      ...(specialtyIds ? { specialties: { some: { specialtyId: { in: specialtyIds } } } } : {}),
      ...(q.name
        ? { user: { fullName: { contains: q.name, mode: "insensitive" } } }
        : {}),
      // Location filters apply to the doctor's chambers.
      ...((q.district || q.city || hospitalIds)
        ? {
            chambers: {
              some: {
                isActive: true,
                deletedAt: null,
                ...(q.district ? { district: normalizeLocationName(q.district) } : {}),
                ...(q.city ? { city: normalizeLocationName(q.city) } : {}),
                ...(hospitalIds ? { hospitalId: { in: hospitalIds } } : {}),
              },
            },
          }
        : {}),
    };

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: {
          user: { select: { fullName: true, profilePhoto: true } },
          specialties: {
            include: {
              specialty: { select: { id: true, name: true, nameBn: true, slug: true, icon: true } },
            },
          },
          chambers: {
            where: { isActive: true, deletedAt: null },
            select: { id: true, chamberName: true, city: true, district: true, hospitalId: true },
          },
        },
        orderBy: SORT_MAP[q.sort],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.doctor.count({ where }),
    ]);

    logRequest("GET", path, 200, nowMs() - start);
    return ok(
      { doctors: doctors.map(toDoctorCard) },
      200,
      { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    );
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
