import type { NextRequest, NextResponse } from "next/server";
import { getRefreshTokenTtlSeconds } from "@/lib/jwt";

/**
 * Cookie constants for the secure refresh token. The access token
 * is returned in the JSON body (short-lived, 15m) while the
 * refresh token lives in an httpOnly, secure, sameSite cookie so
 * JavaScript cannot read it.
 *
 * Reading: cookies are read from the incoming Request object
 * (req.cookies). Writing: cookies are written to the outgoing
 * Response object (res.cookies). This keeps the handlers pure and
 * testable outside the Next.js request store.
 */
export const REFRESH_COOKIE_NAME = "godr_refresh";

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: getRefreshTokenTtlSeconds(),
  };
}

/** Read the refresh token from the incoming request's cookies. */
export function readRefreshTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
}

/** Set the refresh-token cookie on an outgoing response. */
export function setRefreshCookie(res: NextResponse, token: string): void {
  res.cookies.set(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
}

/** Clear the refresh-token cookie on an outgoing response (logout). */
export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.delete(REFRESH_COOKIE_NAME);
}
