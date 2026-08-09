import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { verifyPassword } from "@/lib/password";
import { issueTokenPair } from "@/lib/tokens";
import { setRefreshCookie } from "@/lib/cookie";
import { toPublicUser } from "@/lib/projections";
import { loginSchema } from "@/lib/validators";
import { rateLimit, AUTH_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/auth/login";
  try {
    rateLimit(`${getClientIp(req)}:login`, AUTH_RATE_LIMIT);

    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { identifier, password } = parsed.data;

    // Identifier can be a phone (starts with 0/+) or an email.
    const isEmail = identifier.includes("@");
    const normalizedIdentifier = isEmail
      ? identifier.toLowerCase().trim()
      : identifier.replace(/^\+?880/, "0");

    const where = isEmail
      ? { email: normalizedIdentifier }
      : { phone: normalizedIdentifier };

    const user = await prisma.user.findFirst({
      where: { ...where, deletedAt: null },
    });

    // Always run a compare to avoid timing-based user enumeration.
    const dummyHash = "$2a$12$abcdefghijklmnopqrstuv";
    const passwordValid = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, dummyHash);

    if (!user || !passwordValid) {
      throw errors.unauthorized("Invalid credentials");
    }
    if (!user.isActive) {
      throw errors.forbidden("Account is deactivated");
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);
    const res = ok({ user: toPublicUser(user), accessToken });
    setRefreshCookie(res, refreshToken);

    logRequest("POST", path, 200, nowMs() - start);
    return res;
  } catch (err) {
    logRequest("POST", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
