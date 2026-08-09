import { errors } from "@/lib/errors";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Maximum tokens (requests) allowed per window per key. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Simple in-memory fixed-window rate limiter, keyed by an
 * arbitrary string (typically `${ip}:${route}`).
 *
 * Adequate for a single-process deployment. For multi-instance
 * production, swap the backing store for Redis without changing
 * the call sites.
 */
const store = new Map<string, Bucket>();

export function rateLimit(key: string, config: RateLimitConfig): void {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket) {
    store.set(key, { tokens: config.limit - 1, lastRefill: now });
    return;
  }

  // If the window has elapsed, reset the bucket.
  if (now - bucket.lastRefill > config.windowMs) {
    bucket.tokens = config.limit - 1;
    bucket.lastRefill = now;
    return;
  }

  if (bucket.tokens <= 0) {
    throw errors.tooManyRequests("Too many attempts. Please try again later.");
  }
  bucket.tokens -= 1;
}

/** Auth endpoints are stricter: 5 attempts per minute per IP. */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowMs: 60 * 1000,
};

/** General endpoints: 60 requests per minute per IP. */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  limit: 60,
  windowMs: 60 * 1000,
};

/** Extract a best-effort client IP from Next.js request headers. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Test-only: clear the in-memory rate-limit store. */
export function __resetRateLimitStoreForTests(): void {
  store.clear();
}
