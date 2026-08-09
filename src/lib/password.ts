import bcrypt from "bcryptjs";

/**
 * Resolve the bcrypt cost factor from the environment, clamped to a
 * safe range. Defaults to 12.
 */
export function getBcryptCost(): number {
  const raw = Number(process.env.BCRYPT_COST);
  if (!Number.isFinite(raw) || raw < 10) return 12;
  return Math.min(raw, 15);
}

/** Hash a plaintext password using bcrypt. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, getBcryptCost());
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
