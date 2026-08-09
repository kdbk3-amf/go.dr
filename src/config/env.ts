import { z } from "zod";

/**
 * Centralised, validated runtime configuration.
 * Throws early (at import time) if required environment variables
 * are missing or malformed, so misconfigurations surface during
 * startup instead of mid-request.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_NAME: z.string().default("Go Dr"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),

  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  // Seed-only values (optional outside seeding)
  SEED_ADMIN_NAME: z.string().default("System Administrator"),
  SEED_ADMIN_EMAIL: z.string().email().default("admin@godr.bd"),
  SEED_ADMIN_PHONE: z.string().default("01700000000"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("ChangeMeAdmin123!"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
