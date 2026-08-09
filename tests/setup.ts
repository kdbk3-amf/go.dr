/**
 * Vitest global setup.
 * Loads a test-specific .env so the app config (JWT_SECRET etc.)
 * resolves, deploys migrations, and seeds reference data
 * (specialties + hospitals) into the test database so the Phase 2
 * public listing / search tests have data to work against.
 */
import { config } from "dotenv";
import { execSync } from "node:child_process";
import { PrismaClient } from "../src/lib/generated/prisma";
import { BANGLADESH_DIVISIONS, slugify } from "../src/lib/locations";

config({ path: ".env.test" });

const prisma = new PrismaClient();

let isSetup = false;

async function seedReferenceData() {
  // Divisions + districts.
  for (const div of BANGLADESH_DIVISIONS) {
    const division = await prisma.division.upsert({
      where: { slug: slugify(div.name) },
      update: {},
      create: { name: div.name, nameBn: div.nameBn, slug: slugify(div.name), isActive: true },
    });
    for (const d of div.districts) {
      await prisma.district.upsert({
        where: { name_divisionId: { name: d.name, divisionId: division.id } },
        update: {},
        create: { name: d.name, nameBn: d.nameBn, slug: slugify(d.name), divisionId: division.id, isActive: true },
      });
    }
  }

  // A small set of specialties for tests.
  const specs = [
    { name: "Cardiology", slug: "cardiology", nameBn: "হৃদরোগ", icon: "heart" },
    { name: "Neurology", slug: "neurology", nameBn: "নিউরোলজি", icon: "brain" },
    { name: "Medicine", slug: "medicine", nameBn: "মেডিসিন", icon: "stethoscope" },
  ];
  for (const s of specs) {
    await prisma.specialty.upsert({
      where: { slug: s.slug },
      update: { isActive: true, deletedAt: null },
      create: { name: s.name, nameBn: s.nameBn, slug: s.slug, icon: s.icon, isActive: true },
    });
  }

  // A small set of hospitals for tests.
  const hosps = [
    { name: "Square Hospital Ltd", slug: "square-hospital-ltd", address: "Panthapath, Dhaka", city: "Dhaka", district: "Dhaka", division: "Dhaka" },
    { name: "Chattogram Medical College Hospital", slug: "chittagong-medical-college-hospital", address: "Chattogram", city: "Chattogram", district: "Chattogram", division: "Chattogram" },
  ];
  for (const h of hosps) {
    await prisma.hospital.upsert({
      where: { slug: h.slug },
      update: { isActive: true, deletedAt: null },
      create: { name: h.name, slug: h.slug, address: h.address, city: h.city, district: h.district, division: h.division, isActive: true },
    });
  }
}

export async function setup() {
  if (isSetup) return;
  isSetup = true;

  // Deploy migrations to the test DB.
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

  // Seed reference data (idempotent upserts).
  await seedReferenceData().catch(() => {
    // non-fatal; individual tests create their own data as needed
  });
}

export async function teardown() {
  await prisma.$disconnect();
}
