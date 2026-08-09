import { z } from "zod";

/**
 * Shared Zod validation schemas for auth & profile endpoints.
 * Bangladesh-specific validation (phone, BMDC) lives here.
 */

// Bangladeshi mobile numbers: 01XXXXXXXXX (11 digits) or +8801XXXXXXXXX.
const bangladeshPhone = z
  .string()
  .trim()
  .regex(
    /^(?:\+?880|0)1[3-9]\d{8}$/,
    "Enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)",
  )
  .transform((v) => v.replace(/^\+?880/, "0"));

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(150);

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long (max 72 characters for bcrypt)")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const fullName = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters")
  .max(150, "Full name is too long");

export const genderEnum = z.enum(["male", "female", "other"]);
export const bloodGroupEnum = z.enum([
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE",
]);

// ----- Auth -----
export const registerSchema = z
  .object({
    fullName,
    email: email.optional().or(z.literal("")),
    phone: bangladeshPhone,
    password,
    role: z.enum(["patient", "doctor"]),
  })
  .refine((d) => d.email !== undefined, { message: "Email is required", path: ["email"] });

// After transform email "" -> undefined for consistent handling.
export const normalizedRegisterSchema = registerSchema.transform((d) => ({
  ...d,
  email: d.email && d.email.length > 0 ? d.email : undefined,
}));

export const loginSchema = z.object({
  // Login accepts either phone or email as the identifier.
  identifier: z.string().trim().min(1, "Identifier is required"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

// ----- Patient profile -----
export const updatePatientSchema = z.object({
  fullName: fullName.optional(),
  email: email.optional(),
  phone: bangladeshPhone.optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: genderEnum.optional(),
  bloodGroup: bloodGroupEnum.optional(),
  address: z.string().trim().max(255).optional(),
  emergencyContactName: z.string().trim().max(150).optional(),
  emergencyContactPhone: bangladeshPhone.optional(),
  profilePhoto: z.string().trim().url().max(500).optional(),
});

// ----- Doctor profile -----
// Doctors cannot edit their verification status (isVerified) —
// it is intentionally absent from this schema.
export const updateDoctorSchema = z.object({
  fullName: fullName.optional(),
  nameBn: z.string().trim().min(2).max(150).optional(),
  email: email.optional(),
  phone: bangladeshPhone.optional(),
  profilePhoto: z.string().trim().url().max(500).optional(),
  qualification: z.string().trim().min(2).max(200).optional(),
  bmdcRegNo: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{3,50}$/i, "Enter a valid BMDC registration number")
    .optional(),
  experienceYears: z.number().int().min(0).max(70).optional(),
  consultationFee: z.number().nonnegative().max(100000).optional(),
  bio: z.string().trim().max(2000).optional(),
});

// ----- Admin -----
export const verifyDoctorSchema = z.object({
  isVerified: z.boolean(),
});

// ============================================================
// Phase 2 — Specialties / Hospitals / Chambers / Doctor search
// ============================================================

const slug = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits and hyphens");

const safeString = (max: number) => z.string().trim().min(1).max(max);

// ----- Specialty (admin CRUD) -----
export const createSpecialtySchema = z.object({
  name: safeString(150),
  nameBn: z.string().trim().max(150).optional(),
  slug: slug.optional(), // auto-generated if omitted
  icon: z.string().trim().max(100).optional(),
  parentId: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export const updateSpecialtySchema = z.object({
  name: safeString(150).optional(),
  nameBn: z.string().trim().max(150).optional(),
  slug: slug.optional(),
  icon: z.string().trim().max(100).optional(),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// ----- Hospital (admin CRUD) -----
export const createHospitalSchema = z.object({
  name: safeString(200),
  nameBn: z.string().trim().max(200).optional(),
  slug: slug.optional(),
  address: safeString(500),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  division: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email().max(150).optional().or(z.literal("")),
  website: z.string().trim().url().max(500).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
});

export const updateHospitalSchema = z.object({
  name: safeString(200).optional(),
  nameBn: z.string().trim().max(200).optional(),
  slug: slug.optional(),
  address: safeString(500).optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  division: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email().max(150).optional().or(z.literal("")),
  website: z.string().trim().url().max(500).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
});

// ----- Chamber (doctor own CRUD + admin) -----
export const createChamberSchema = z.object({
  hospitalId: z.coerce.bigint().positive().optional().nullable(),
  chamberName: safeString(200),
  address: safeString(500),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  visitingDays: safeString(100),
  // Time-of-day as "HH:mm" (24h). Stored as @db.Time via Date.
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be HH:mm"),
  slotDurationMinutes: z.number().int().min(5).max(180).optional(),
  consultationFee: z.number().nonnegative().max(100000).optional(),
  isActive: z.boolean().optional(),
});

export const updateChamberSchema = z.object({
  hospitalId: z.coerce.bigint().positive().nullable().optional(),
  chamberName: safeString(200).optional(),
  address: safeString(500).optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  visitingDays: safeString(100).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDurationMinutes: z.number().int().min(5).max(180).optional(),
  consultationFee: z.number().nonnegative().max(100000).optional(),
  isActive: z.boolean().optional(),
});

// ----- Pagination (shared query parser) -----
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ----- Doctor search query -----
export const doctorSearchSchema = paginationSchema.extend({
  name: z.string().trim().max(150).optional(),
  specialty: z.string().trim().max(160).optional(), // name or slug
  specialtySlug: z.string().trim().max(160).optional(),
  district: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  hospital: z.string().trim().max(200).optional(), // name or slug
  minExperience: z.coerce.number().int().min(0).max(70).optional(),
  maxFee: z.coerce.number().nonnegative().max(100000).optional(),
  minFee: z.coerce.number().nonnegative().max(100000).optional(),
  verified: z.enum(["true", "false"]).optional(),
  available: z.enum(["true", "false"]).optional(),
  sort: z
    .enum(["experience", "experience_desc", "fee", "fee_desc", "name", "name_desc", "newest"])
    .default("newest"),
});

// ----- Hospital search query -----
export const hospitalSearchSchema = paginationSchema.extend({
  name: z.string().trim().max(200).optional(),
  district: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  division: z.string().trim().max(100).optional(),
  active: z.enum(["true", "false"]).optional(),
});
