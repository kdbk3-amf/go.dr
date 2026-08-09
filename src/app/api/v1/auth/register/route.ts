import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, ok } from "@/lib/api";
import { errors } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { issueTokenPair } from "@/lib/tokens";
import { setRefreshCookie } from "@/lib/cookie";
import { toPublicUser } from "@/lib/projections";
import { normalizedRegisterSchema } from "@/lib/validators";
import { rateLimit, AUTH_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";
import { UserRole } from "@/lib/generated/prisma";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/auth/register";
  try {
    rateLimit(`${getClientIp(req)}:register`, AUTH_RATE_LIMIT);

    const body = await req.json().catch(() => ({}));
    const parsed = normalizedRegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { fullName, email, phone, password, role } = parsed.data;

    // Uniqueness check (returns clean 409 instead of raw Prisma error).
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ phone }, ...(email ? [{ email }] : [])],
        deletedAt: null,
      },
      select: { phone: true, email: true },
    });
    if (existing) {
      if (existing.phone === phone) throw errors.conflict("This phone number is already registered");
      throw errors.conflict("This email is already registered");
    }

    const passwordHash = await hashPassword(password);

    // Create user + role-specific profile in one transaction.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName,
          email,
          phone,
          passwordHash,
          role: role as UserRole,
          isVerified: false,
          isActive: true,
        },
      });

      if (role === "patient") {
        await tx.patient.create({ data: { userId: created.id } });
      } else {
        await tx.doctor.create({ data: { userId: created.id } });
      }
      return created;
    });

    const { accessToken, refreshToken } = await issueTokenPair(user);
    const res = ok({ user: toPublicUser(user), accessToken }, 201);
    setRefreshCookie(res, refreshToken);

    logRequest("POST", path, 201, nowMs() - start);
    return res;
  } catch (err) {
    logRequest("POST", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
