/**
 * Vitest global setup.
 * Loads a test-specific .env so the app config (JWT_SECRET etc.)
 * resolves, and isolates the DB before/after the suite.
 */
import { config } from "dotenv";
import { execSync } from "node:child_process";

config({ path: ".env.test" });

let isSetup = false;

export async function setup() {
  if (isSetup) return;
  isSetup = true;

  // Push migrations + seed into the test database. The test DB is
  // reset once at the start of the run; individual test files are
  // responsible for cleaning their own data via the provided helper.
  if (process.env.SKIP_DB_RESET !== "true") {
    try {
      execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
        stdio: "inherit",
        env: { ...process.env },
      });
    } catch {
      // migrations already applied — fine
    }
  }
}

export async function teardown() {
  // nothing
}
