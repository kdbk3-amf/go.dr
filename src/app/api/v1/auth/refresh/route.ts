import { NextRequest } from "next/server";
import { withErrorHandler, ok, fail } from "@/lib/api";
import { errors, HttpError } from "@/lib/errors";
import { rotateRefreshToken, revokeRefreshToken } from "@/lib/tokens";
import { readRefreshTokenFromRequest, clearRefreshCookie, getRefreshCookieOptions } from "@/lib/cookie";
import { rateLimit, AUTH_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/auth/refresh";
  let status = 500;
  try {
    rateLimit(`${getClientIp(req)}:refresh`, AUTH_RATE_LIMIT);

    // Refresh token from httpOnly cookie, falling back to JSON body.
    let refreshToken = readRefreshTokenFromRequest(req);
    if (!refreshToken) {
      const body = (await req.json().catch(() => ({}))) as { refreshToken?: string };
      refreshToken = body.refreshToken ?? null;
    }
    if (!refreshToken) {
      status = 401;
      throw errors.unauthorized("No refresh token provided");
    }

    const { accessToken, refreshToken: newRefreshToken } = await rotateRefreshToken(refreshToken);

    const res = ok({ accessToken });
    // Rotate the cookie too (reuse the shared options).
    res.cookies.set("godr_refresh", newRefreshToken, getRefreshCookieOptions());

    logRequest("POST", path, 200, nowMs() - start);
    return res;
  } catch (err) {
    // On refresh failure, revoke the presented token (if any) and
    // return an error response with the cookie cleared.
    const presented = readRefreshTokenFromRequest(req);
    if (presented) await revokeRefreshToken(presented);
    status = err instanceof HttpError ? err.status : 500;
    logRequest("POST", path, status, nowMs() - start);
    const httpErr = err instanceof HttpError ? err : errors.internal();
    const res = fail(httpErr);
    clearRefreshCookie(res);
    return res;
  }
});
