import { NextRequest } from "next/server";
import { withErrorHandler, ok } from "@/lib/api";
import { revokeRefreshToken } from "@/lib/tokens";
import { readRefreshTokenFromRequest, clearRefreshCookie } from "@/lib/cookie";
import { authenticate } from "@/lib/auth";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/auth/logout";
  try {
    // Best-effort auth: logout succeeds even if access token expired.
    try {
      await authenticate(req);
    } catch {
      // ignore — still revoke the refresh token.
    }

    const refreshToken = readRefreshTokenFromRequest(req);
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    const res = ok({ message: "Logged out successfully" });
    clearRefreshCookie(res);

    logRequest("POST", path, 200, nowMs() - start);
    return res;
  } catch (err) {
    logRequest("POST", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
