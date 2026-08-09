import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "@/config/env";
import { errors } from "@/lib/errors";
import type { UserRole } from "@/lib/generated/prisma";

export interface AccessTokenPayload extends JwtPayload {
  sub: string; // user id as string
  role: UserRole;
  tokenId: string; // jti
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  tokenId: string;
}

/** Parse a human-readable duration like "15m" / "7d" into seconds. */
function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 900; // default 15m
  const num = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return num * multipliers[unit!]!;
}

export function getAccessTokenTtlSeconds(): number {
  return parseDuration(env.JWT_ACCESS_EXPIRES);
}

export function getRefreshTokenTtlSeconds(): number {
  return parseDuration(env.JWT_REFRESH_EXPIRES);
}

/** Issue a short-lived access JWT. */
export function signAccessToken(userId: bigint, role: UserRole, tokenId: string): string {
  return jwt.sign(
    { sub: userId.toString(), role, tokenId } satisfies AccessTokenPayload,
    env.JWT_SECRET,
    { expiresIn: getAccessTokenTtlSeconds(), jwtid: tokenId },
  );
}

/** Issue a long-lived refresh JWT. */
export function signRefreshToken(userId: bigint, tokenId: string): string {
  return jwt.sign(
    { sub: userId.toString(), tokenId } satisfies RefreshTokenPayload,
    env.JWT_SECRET,
    { expiresIn: getRefreshTokenTtlSeconds(), jwtid: tokenId },
  );
}

/** Verify and decode an access token. Throws HttpError(401) on failure. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    if (!decoded.sub || !decoded.role || !decoded.tokenId) {
      throw errors.unauthorized("Invalid token");
    }
    return decoded;
  } catch {
    throw errors.unauthorized("Invalid or expired token");
  }
}

/** Verify and decode a refresh token. Throws HttpError(401) on failure. */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as RefreshTokenPayload;
    if (!decoded.sub || !decoded.tokenId) {
      throw errors.unauthorized("Invalid token");
    }
    return decoded;
  } catch {
    throw errors.unauthorized("Invalid or expired refresh token");
  }
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + getRefreshTokenTtlSeconds() * 1000);
}
