import { toJsonSafe } from "@/lib/serialize";
import type { User, Patient, Doctor } from "@/lib/generated/prisma";

type JsonPrimitive = string | number | boolean | null;
type JsonVal = JsonPrimitive | JsonVal[] | { [k: string]: JsonVal };
/** Recursively drop any field whose name is in the denylist. */
function sanitize<T>(value: T, denylist: Set<string>): JsonVal {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, denylist));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value as JsonVal;
  const out: { [k: string]: JsonVal } = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (denylist.has(k)) continue;
    out[k] = sanitize(v, denylist);
  }
  return out;
}

const SENSITIVE_FIELDS = new Set(["passwordHash", "deletedAt", "tokenHash", "code"]);

/** Return a public-safe user object (never includes passwordHash). */
export function toPublicUser(user: User): Record<string, unknown> {
  return sanitize(toJsonSafe(user), SENSITIVE_FIELDS) as Record<string, unknown>;
}

/** Public-safe user + nested patient profile. */
export function toPublicPatient(user: User & { patient: Patient | null }): Record<string, unknown> {
  return sanitize(toJsonSafe(user), SENSITIVE_FIELDS) as Record<string, unknown>;
}

/** Public-safe user + nested doctor profile. */
export function toPublicDoctor(user: User & { doctor: Doctor | null }): Record<string, unknown> {
  return sanitize(toJsonSafe(user), SENSITIVE_FIELDS) as Record<string, unknown>;
}
