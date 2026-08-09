import { NextRequest } from "next/server";
import { withErrorHandler, ok } from "@/lib/api";
import { authenticate } from "@/lib/auth";
import { toPublicUser } from "@/lib/projections";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const start = nowMs();
  const path = "/api/v1/auth/me";
  try {
    const ctx = await authenticate(req);
    logRequest("GET", path, 200, nowMs() - start);
    return ok({ user: toPublicUser(ctx.user) });
  } catch (err) {
    logRequest("GET", path, err instanceof Error && "status" in err ? (err as { status: number }).status : 500, nowMs() - start);
    throw err;
  }
});
