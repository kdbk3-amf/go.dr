/**
 * JSON cannot represent BigInt natively. NextResponse.json uses
 * JSON.stringify, which throws on BigInt. These helpers serialize
 * user-facing payloads into plain JSON-safe objects where every
 * BigInt becomes a string.
 */

export type JsonSafe =
  | string
  | number
  | boolean
  | null
  | JsonSafe[]
  | { [key: string]: JsonSafe };

/** Convert any value containing BigInt into a JSON-safe structure. */
export function toJsonSafe(value: unknown): JsonSafe {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === "object") {
    const out: { [key: string]: JsonSafe } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toJsonSafe(v);
    }
    return out;
  }
  return String(value);
}
