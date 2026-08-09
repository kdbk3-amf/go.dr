/**
 * Shared query/pagination helpers for the Phase 2 public + admin
 * listing endpoints. Keeps route handlers thin and consistent.
 */
import { errors } from "@/lib/errors";

/** Parse a URLSearchParams bag into a plain string record. */
export function paramsToObject(sp: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of sp.entries()) out[k] = v;
  return out;
}

/**
 * Validate query params against a Zod schema. Throws a clean 400
 * HttpError (never leaks Zod internals beyond the first message).
 */
export function parseQuery<T>(sp: URLSearchParams, schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false; error: { issues: { message?: string }[] } } }): T {
  const parsed = schema.safeParse(paramsToObject(sp));
  if (!parsed.success) {
    throw errors.badRequest(parsed.error.issues[0]?.message ?? "Invalid query");
  }
  return parsed.data;
}

/** Convert "HH:mm" (24-hour) into a Date usable for @db.Time columns. */
export function timeOfDay(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

/** Format a @db.Time Date back to "HH:mm" for responses. */
export function formatTimeOfDay(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
