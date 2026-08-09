import { prisma } from "@/lib/prisma";
import type { OtpPurpose } from "@/lib/generated/prisma";
import { env } from "@/config/env";

/**
 * OTP infrastructure (architecture only — no real SMS provider yet).
 *
 * The interface below defines the contract any SMS provider must
 * satisfy (e.g. a future bKash/SSLCommerz SMS gateway). In
 * development the OTP is logged to the console so flows can be
 * tested end-to-end without a provider. Swap `consoleOtpTransport`
 * for a real transport in production without touching call sites.
 */

export interface OtpTransport {
  /** Send a 6-digit OTP to the given phone. */
  send(phone: string, code: string, purpose: OtpPurpose): Promise<void>;
}

/** Dev-only transport: prints the OTP server-side (never SMS). */
export const consoleOtpTransport: OtpTransport = {
  async send(phone, code, purpose) {
    if (env.NODE_ENV !== "production") {
      console.log(`[OTP] ${purpose} code for ${phone}: ${code}`);
    }
    // In production a real provider must be wired here.
  },
};

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_TTL_MINUTES = 5;

/**
 * Create and "send" an OTP for a user. The hashed/stored form is
 * the code itself for now (dev); a production implementation would
 * store a hash (like passwords) and verify by hashing the input.
 */
export async function issueOtp(
  userId: bigint,
  phone: string,
  purpose: OtpPurpose,
  transport: OtpTransport = consoleOtpTransport,
): Promise<string> {
  const code = generate6DigitCode();
  await prisma.otpCode.create({
    data: {
      userId,
      code,
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });
  await transport.send(phone, code, purpose);
  return code;
}

export interface OtpVerificationResult {
  valid: boolean;
  reason?: "expired" | "used" | "not_found";
}

/** Verify an OTP without consuming it. */
export async function verifyOtp(
  userId: bigint,
  code: string,
  purpose: OtpPurpose,
): Promise<OtpVerificationResult> {
  const record = await prisma.otpCode.findFirst({
    where: { userId, code, purpose, isUsed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { valid: false, reason: "not_found" };
  if (record.expiresAt < new Date()) return { valid: false, reason: "expired" };
  return { valid: true };
}

/** Consume (mark used) an OTP after successful verification. */
export async function consumeOtp(userId: bigint, code: string, purpose: OtpPurpose): Promise<void> {
  await prisma.otpCode.updateMany({
    where: { userId, code, purpose, isUsed: false },
    data: { isUsed: true },
  });
}
