import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/jwt";
import type { User, UserRole } from "@/lib/generated/prisma";

export interface AuthContext {
  user: User;
  userId: bigint;
  role: UserRole;
}

/** Extract the Bearer token from the Authorization header. */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]! : null;
}

/**
 * Authenticate a request by verifying the access token and loading
 * the active user. Throws HttpError(401) when missing/invalid.
 */
export async function authenticate(req: Request): Promise<AuthContext> {
  const token = extractBearerToken(req);
  if (!token) throw errors.unauthorized("Authentication required");

  const payload = verifyAccessToken(token);
  const userId = BigInt(payload.sub);

  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
  });
  if (!user) throw errors.unauthorized("Account not found or inactive");

  return { user, userId, role: user.role };
}

/**
 * Authenticate and require one of the allowed roles. Throws 403
 * when the role doesn't match.
 */
export async function authorize(req: Request, allowedRoles: UserRole[]): Promise<AuthContext> {
  const ctx = await authenticate(req);
  if (!allowedRoles.includes(ctx.role)) {
    throw errors.forbidden("You do not have permission to access this resource");
  }
  return ctx;
}
