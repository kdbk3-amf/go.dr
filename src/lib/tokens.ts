import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from "@/lib/jwt";
import type { User } from "@/lib/generated/prisma";

/** Hash a refresh token (SHA-256) before storing so a DB leak
 *  cannot replay tokens. */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** A random opaque id used as the JWT jti + DB lookup key. */
function newTokenId(): string {
  return crypto.randomUUID();
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Issue a fresh access + (rotating) refresh token pair for a user. */
export async function issueTokenPair(user: User): Promise<TokenPair> {
  const tokenId = newTokenId();
  const refreshToken = signRefreshToken(user.id, tokenId);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const accessToken = signAccessToken(user.id, user.role, tokenId);
  return { accessToken, refreshToken };
}

/**
 * Verify a refresh token, rotate it (revoke old, issue new), and
 * return a new pair. Rotation limits the damage of a stolen
 * refresh token: a reused (already-rotated) token is rejected.
 */
export async function rotateRefreshToken(presentedRefreshToken: string): Promise<TokenPair> {
  const payload = verifyRefreshToken(presentedRefreshToken);
  const userId = BigInt(payload.sub);
  const presentedHash = hashToken(presentedRefreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: presentedHash },
  });

  if (!stored || stored.userId !== userId) {
    throw errors.unauthorized("Invalid refresh token");
  }
  if (stored.isRevoked) {
    // Possible token reuse/theft — revoke the whole family for safety.
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    throw errors.unauthorized("Refresh token has been revoked");
  }
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });
    throw errors.unauthorized("Refresh token expired");
  }

  // Rotate: revoke the presented token, issue a new one.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { isRevoked: true },
  });

  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
  });
  if (!user) throw errors.unauthorized("Account not found or inactive");

  return issueTokenPair(user);
}

/** Revoke a presented refresh token (used on logout). */
export async function revokeRefreshToken(presentedRefreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(presentedRefreshToken);
    const tokenHash = hashToken(presentedRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, userId: BigInt(payload.sub) },
      data: { isRevoked: true },
    });
  } catch {
    // Token invalid/expired — nothing to revoke, fail silently.
  }
}

/** Revoke all refresh tokens for a user (e.g. on password change). */
export async function revokeAllUserTokens(userId: bigint): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { isRevoked: true },
  });
}
