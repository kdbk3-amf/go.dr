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

/** Reset the in-memory rate limiter between tests. */
export async function resetRateLimit(): Promise<void> {
  const { __resetRateLimitStoreForTests } = await import("@/lib/rate-limit");
  __resetRateLimitStoreForTests();
}
