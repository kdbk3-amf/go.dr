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
