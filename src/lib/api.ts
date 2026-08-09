import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, errors } from "@/lib/errors";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** Wrap a successful payload in the standard response envelope. */
export function ok<T>(data: T, status = 200, meta?: Record<string, unknown>): NextResponse<ApiSuccess<T>> {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data, ...(meta ? { meta } : {}) }, { status });
}

/** Build a uniform JSON error response (never leaks internals). */
export function fail(error: HttpError): NextResponse<ApiError> {
  const body: ApiError = {
    success: false,
    error: { code: error.code, message: error.message },
  };
  return NextResponse.json<ApiError>(body, { status: error.status });
}

/**
 * Run a route handler with centralized error handling. Any thrown
 * HttpError is mapped to a clean response; ZodErrors become 400s;
 * everything else becomes a generic 500 (with the real message
 * logged server-side, never sent to the client).
 */
export function withErrorHandler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return fail(err);
      }
      if (err instanceof z.ZodError) {
        return fail(errors.badRequest("Validation failed"));
      }
      // Prisma unique-constraint violation (P2002) -> 409 conflict
      if (isPrismaError(err) && err.code === "P2002") {
        const target = (err.meta as { target?: string[] } | undefined)?.target;
        const field = target?.[0] ?? "resource";
        return fail(errors.conflict(`A user with this ${field} already exists`));
      }
      // Log the real error server-side; send a generic message.
      console.error("[api] unhandled error:", err);
      return fail(errors.internal());
    }
  };
}

function isPrismaError(err: unknown): err is { code: string; meta?: unknown } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  );
}
