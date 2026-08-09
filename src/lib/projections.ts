import { toJsonSafe } from "@/lib/serialize";
import type { User, Patient, Doctor, Specialty, Hospital, Chamber, Appointment } from "@/lib/generated/prisma";
import { formatTimeOfDay } from "@/lib/query";

type JsonPrimitive = string | number | boolean | null;
type JsonVal = JsonPrimitive | JsonVal[] | { [k: string]: JsonVal };
/** Recursively drop any field whose name is in the denylist. */
function sanitize<T>(value: T, denylist: Set<string>): JsonVal {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, denylist));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value as JsonVal;
  const out: { [k: string]: JsonVal } = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (denylist.has(k)) continue;
    out[k] = sanitize(v, denylist);
  }
  return out;
}

const SENSITIVE_FIELDS = new Set(["passwordHash", "deletedAt", "tokenHash", "code"]);

/** Return a public-safe user object (never includes passwordHash). */
export function toPublicUser(user: User): Record<string, unknown> {
  return sanitize(toJsonSafe(user), SENSITIVE_FIELDS) as Record<string, unknown>;
}

/** Public-safe user + nested patient profile. */
export function toPublicPatient(user: User & { patient: Patient | null }): Record<string, unknown> {
  return sanitize(toJsonSafe(user), SENSITIVE_FIELDS) as Record<string, unknown>;
}

/** Public-safe user + nested doctor profile. */
export function toPublicDoctor(user: User & { doctor: Doctor | null }): Record<string, unknown> {
  return sanitize(toJsonSafe(user), SENSITIVE_FIELDS) as Record<string, unknown>;
}

/** Public-safe specialty (drops soft-delete column). */
export function toPublicSpecialty(s: Specialty): Record<string, unknown> {
  return sanitize(toJsonSafe(s), SENSITIVE_FIELDS) as Record<string, unknown>;
}

/** Public-safe hospital (drops soft-delete column). */
export function toPublicHospital(h: Hospital): Record<string, unknown> {
  return sanitize(toJsonSafe(h), SENSITIVE_FIELDS) as Record<string, unknown>;
}

/** Public-safe chamber (drops soft-delete column). */
export function toPublicChamber(c: Chamber): Record<string, unknown> {
  return sanitize(toJsonSafe(c), SENSITIVE_FIELDS) as Record<string, unknown>;
}

/**
 * Build the doctor "card" shape returned by the public search/list
 * endpoint: only verified-active doctors, only public fields, with
 * specialties and a chamber/location summary. Never includes
 * passwordHash, phone, email, or other private fields.
 */
export function toDoctorCard(doctor: {
  id: bigint;
  nameBn: string | null;
  qualification: string | null;
  experienceYears: number;
  consultationFee: { toString: () => string };
  bio: string | null;
  profilePhoto: string | null;
  bmdcRegNo: string | null;
  isVerified: boolean;
  isAvailable: boolean;
  user: { fullName: string; profilePhoto: string | null } | null;
  specialties: { specialty: { id: bigint; name: string; nameBn: string | null; slug: string; icon: string | null } }[];
  chambers: { id: bigint; chamberName: string; city: string | null; district: string | null; hospitalId: bigint | null }[];
}): Record<string, unknown> {
  return {
    id: doctor.id.toString(),
    name: doctor.user?.fullName ?? null,
    nameBn: doctor.nameBn,
    profilePhoto: doctor.profilePhoto ?? doctor.user?.profilePhoto ?? null,
    qualification: doctor.qualification,
    experienceYears: doctor.experienceYears,
    consultationFee: doctor.consultationFee.toString(),
    bio: doctor.bio,
    bmdcRegNo: doctor.bmdcRegNo,
    isVerified: doctor.isVerified,
    isAvailable: doctor.isAvailable,
    specialties: doctor.specialties.map((ds) => ({
      id: ds.specialty.id.toString(),
      name: ds.specialty.name,
      nameBn: ds.specialty.nameBn,
      slug: ds.specialty.slug,
      icon: ds.specialty.icon,
    })),
    chambers: doctor.chambers.map((c) => ({
      id: c.id.toString(),
      chamberName: c.chamberName,
      city: c.city,
      district: c.district,
      hospitalId: c.hospitalId ? c.hospitalId.toString() : null,
    })),
  };
}

// ============================================================
// Phase 3 — Appointment projection (public-safe)
// ============================================================
// Never exposes passwordHash/refreshTokens/phone/email of the
// patient or doctor. Exposes only what the booking confirmation
// and appointment detail screens need.
// ============================================================

type AppointmentWithRelations = Appointment & {
  patient?: { user?: { fullName: string } } | null;
  doctor?: { nameBn?: string | null; user?: { fullName: string; profilePhoto?: string | null } } | null;
  chamber?: { chamberName: string; address: string; city?: string | null; district?: string | null } | null;
};

export function toPublicAppointment(a: AppointmentWithRelations): Record<string, JsonVal> {
  return {
    id: a.id.toString(),
    appointmentNumber: a.appointmentNumber,
    patientId: a.patientId.toString(),
    doctorId: a.doctorId.toString(),
    chamberId: a.chamberId.toString(),
    appointmentDate: a.appointmentDate.toISOString().slice(0, 10),
    appointmentTime: formatTimeOfDay(a.appointmentTime),
    serialNo: a.serialNo,
    status: a.status,
    patientProblem: a.patientProblem,
    doctorNotes: a.doctorNotes,
    consultationFee:
      typeof a.fee === "object" && a.fee !== null && "toString" in a.fee
        ? (a.fee as { toString: () => string }).toString()
        : String(a.fee),
    paymentStatus: a.paymentStatus,
    paymentMethod: a.paymentMethod,
    cancelReason: a.cancelReason,
    cancelledBy: a.cancelledBy ? a.cancelledBy.toString() : null,
    cancelledAt: a.cancelledAt ? a.cancelledAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    patient: a.patient ? { fullName: a.patient.user?.fullName ?? null } : null,
    doctor: a.doctor
      ? {
          fullName: a.doctor.user?.fullName ?? null,
          nameBn: a.doctor.nameBn ?? null,
          profilePhoto: a.doctor.user?.profilePhoto ?? null,
        }
      : null,
    chamber: a.chamber
      ? {
          chamberName: a.chamber.chamberName,
          address: a.chamber.address,
          city: a.chamber.city ?? null,
          district: a.chamber.district ?? null,
        }
      : null,
  };
}
