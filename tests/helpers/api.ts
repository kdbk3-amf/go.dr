import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { issueTokenPair } from "@/lib/tokens";
import { signAccessToken } from "@/lib/jwt";
import type { User, UserRole } from "@/lib/generated/prisma";

/**
 * Test helpers for the auth integration suite. Tests exercise the
 * real route handlers against the real database (no mocks), per
 * project testing guidelines.
 */

/**
 * Unique phone/email generators. Phones use a random suffix so
 * repeated test runs (against a non-fresh DB) never collide with
 * users left behind by a previous failed run.
 */
function rand(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export function uniquePhone(): string {
  // 017 + 8 random digits (Bangladesh mobile format).
  return `017${rand(8)}`;
}
export function uniqueEmail(): string {
  return `test_${rand(10)}@example.com`;
}

/** Build a NextRequest with a JSON body, optional auth header, and cookies. */
export function makeRequest(
  url: string,
  init: { method?: string; body?: unknown; token?: string; cookie?: string } = {},
): NextRequest {
  const headers = new Headers();
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (init.token) {
    headers.set("authorization", `Bearer ${init.token}`);
  }
  if (init.cookie) {
    headers.set("cookie", init.cookie);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

/** Create a user with a known password and optional role/profile. */
export async function createUser(opts: {
  role: UserRole;
  phone?: string;
  email?: string;
  password?: string;
  fullName?: string;
  isActive?: boolean;
  isVerified?: boolean;
}): Promise<{ user: User; password: string; accessToken: string }> {
  const phone = opts.phone ?? uniquePhone();
  const email = opts.email ?? uniqueEmail();
  const password = opts.password ?? "Password123!";
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: opts.fullName ?? "Test User",
        email,
        phone,
        passwordHash: await hashPassword(password),
        role: opts.role,
        isActive: opts.isActive ?? true,
        isVerified: opts.isVerified ?? false,
      },
    });
    if (opts.role === "patient") {
      await tx.patient.create({ data: { userId: created.id } });
    } else if (opts.role === "doctor") {
      await tx.doctor.create({ data: { userId: created.id } });
    }
    return created;
  });

  const { accessToken } = await issueTokenPair(user);
  return { user, password, accessToken };
}

/** Issue a standalone access token without persisting a refresh token. */
export function makeAccessToken(userId: bigint, role: UserRole): string {
  return signAccessToken(userId, role, "test-jti");
}

/** Parse a JSON response body. */
export async function parseJson(res: Response): Promise<any> {
  return JSON.parse(await res.text());
}

/** Delete users (and cascade) created during a test. */
export async function cleanupUsers(userIds: bigint[]): Promise<void> {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

/** Delete hospitals created during a test (soft-delete-aware). */
export async function cleanupHospitals(hospitalIds: bigint[]): Promise<void> {
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
}

/** Delete specialties created during a test. */
export async function cleanupSpecialties(specialtyIds: bigint[]): Promise<void> {
  await prisma.specialty.deleteMany({ where: { id: { in: specialtyIds } } });
}

/** Delete appointments created during a test (hard delete). */
export async function cleanupAppointments(ids: bigint[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.appointment.deleteMany({ where: { id: { in: ids } } });
}

/** Delete chambers created during a test (hard delete). */
export async function cleanupChambers(ids: bigint[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.appointment.deleteMany({ where: { chamberId: { in: ids } } });
  await prisma.chamber.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Create an active chamber with a custom visiting schedule for a
 * doctor. Used by Phase 3 appointment tests.
 */
export async function createChamberForDoctor(doctorId: bigint, opts: {
  visitingDays?: string;
  startTimeHour?: number;
  endTimeHour?: number;
  slotDurationMinutes?: number;
  consultationFee?: number;
  isActive?: boolean;
} = {}): Promise<bigint> {
  const chamber = await prisma.chamber.create({
    data: {
      doctorId,
      chamberName: `Test Chamber ${rand(4)}`,
      address: "Test Address",
      city: "Dhaka",
      district: "Dhaka",
      visitingDays: opts.visitingDays ?? "sat,sun,tue,thu",
      startTime: timeOfDay(opts.startTimeHour ?? 10),
      endTime: timeOfDay(opts.endTimeHour ?? 14),
      slotDurationMinutes: opts.slotDurationMinutes ?? 20,
      consultationFee: opts.consultationFee ?? 500,
      isActive: opts.isActive ?? true,
    },
  });
  return chamber.id;
}

/** Pick a future date that falls on a given weekday (0=Sun..6=Sat). */
export function futureDateOnWeekday(weekday: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  // Ensure at least a few days out for the cancellation window.
  if (d.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000) {
    d.setDate(d.getDate() + 7);
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 7);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Create a verified, available doctor with a specialty link and an
 * active chamber. Returns the user, doctor id, access token, and
 * related ids for use in tests.
 */
export async function createVerifiedDoctor(opts: {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  qualification?: string;
  bmdcRegNo?: string;
  experienceYears?: number;
  consultationFee?: number;
  isAvailable?: boolean;
  specialtySlug?: string;
  chamberCity?: string;
  chamberDistrict?: string;
  hospitalId?: bigint;
} = {}): Promise<{
  user: User;
  doctorId: bigint;
  accessToken: string;
  specialtyId: bigint | null;
  chamberId: bigint | null;
}> {
  const { user, accessToken } = await createUser({
    role: "doctor",
    phone: opts.phone,
    email: opts.email,
    password: opts.password ?? "Password123!",
    fullName: opts.fullName ?? "Test Doctor",
    isVerified: true,
  });

  const doctor = await prisma.doctor.update({
    where: { userId: user.id },
    data: {
      qualification: opts.qualification ?? "MBBS",
      bmdcRegNo: opts.bmdcRegNo ?? `BMDC-${rand(6)}`,
      experienceYears: opts.experienceYears ?? 5,
      consultationFee: opts.consultationFee ?? 500,
      isAvailable: opts.isAvailable ?? true,
      isVerified: true,
    },
  });

  let specialtyId: bigint | null = null;
  if (opts.specialtySlug) {
    const specialty = await prisma.specialty.findUnique({ where: { slug: opts.specialtySlug } });
    if (specialty) {
      specialtyId = specialty.id;
      await prisma.doctorSpecialty.create({
        data: { doctorId: doctor.id, specialtyId: specialty.id },
      }).catch(() => {});
    }
  }

  let chamberId: bigint | null = null;
  const chamber = await prisma.chamber.create({
    data: {
      doctorId: doctor.id,
      hospitalId: opts.hospitalId ?? null,
      chamberName: "Test Chamber",
      address: "Test Address",
      city: opts.chamberCity ?? "Dhaka",
      district: opts.chamberDistrict ?? "Dhaka",
      visitingDays: "sat,sun",
      startTime: timeOfDay(10),
      endTime: timeOfDay(14),
      consultationFee: opts.consultationFee ?? 500,
      isActive: true,
    },
  });
  chamberId = chamber.id;

  return { user, doctorId: doctor.id, accessToken, specialtyId, chamberId };
}

/** Time-of-day helper mirroring src/lib/query.ts for tests. */
function timeOfDay(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Reset the in-memory rate limiter between tests. */
export async function resetRateLimit(): Promise<void> {
  const { __resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
  __resetRateLimitStoreForTests();
}
