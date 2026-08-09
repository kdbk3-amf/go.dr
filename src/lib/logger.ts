/**
 * Minimal structured request logger. In production this would be
 * replaced by Pino/Winston + an APM sink; for now it emits a
 * single normalized line per request with method, path, status
 * and duration.
 */
export function logRequest(method: string, path: string, status: number, durationMs: number) {
  const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
  console[level === "ERROR" ? "error" : level === "WARN" ? "warn" : "log"](
    `[${level}] ${method} ${path} ${status} ${durationMs}ms`,
  );
}

export function nowMs(): number {
  return Date.now();
}
