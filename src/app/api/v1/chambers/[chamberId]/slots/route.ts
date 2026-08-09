import { NextRequest } from "next/server";
import { withErrorHandler, ok } from "@/lib/api";
import { parseQuery } from "@/lib/query";
import { slotsQuerySchema } from "@/lib/validators";
import { getAvailableSlots } from "@/lib/appointments/slots";
import { rateLimit, DEFAULT_RATE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logRequest, nowMs } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/v1/chambers/[chamberId]/slots?date=YYYY-MM-DD
 * Public. Returns genuinely available appointment slots for a chamber
 * on a date, honoring the chamber's visiting days, working hours,
 * and slot duration. Past and already-booked slots are unavailable.
 * Inactive chambers / unverified-unavailable doctors return 404.
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { chamberId: string } }) => {
    const start = nowMs();
    const path = "/api/v1/chambers/[chamberId]/slots";
    try {
      rateLimit(`${getClientIp(req)}:slots`, DEFAULT_RATE_LIMIT);

      const { date } = parseQuery(req.nextUrl.searchParams, slotsQuerySchema);
      if (!/^\d+$/.test(params.chamberId)) {
        return ok({ date, chamberId: params.chamberId, slots: [] });
      }
      const result = await getAvailableSlots(BigInt(params.chamberId), date);

      logRequest("GET", path, 200, nowMs() - start);
      return ok(result);
    } catch (err) {
      logRequest(
        "GET",
        path,
        err instanceof Error && "status" in err ? (err as { status: number }).status : 500,
        nowMs() - start,
      );
      throw err;
    }
  },
);
