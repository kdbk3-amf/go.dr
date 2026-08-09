/**
 * Custom error types for predictable, centralized error handling.
 * Each carries an HTTP status code and a public-safe message so
 * internal/database details never leak to clients.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const errors = {
  badRequest: (message = "Bad request") =>
    new HttpError(400, "BAD_REQUEST", message),
  unauthorized: (message = "Unauthorized") =>
    new HttpError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Forbidden") =>
    new HttpError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") =>
    new HttpError(404, "NOT_FOUND", message),
  conflict: (message = "Resource already exists") =>
    new HttpError(409, "CONFLICT", message),
  tooManyRequests: (message = "Too many requests") =>
    new HttpError(429, "TOO_MANY_REQUESTS", message),
  internal: (message = "Internal server error") =>
    new HttpError(500, "INTERNAL_ERROR", message),
};
