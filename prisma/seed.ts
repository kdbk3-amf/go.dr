import { PrismaClient, UserRole } from "../src/lib/generated/prisma";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ------------------------------------------------------------
// Specialties — common medical specialties in Bangladesh
// ------------------------------------------------------------
const specialties = [
  { name: "Cardiology", nameBn: "হৃদরোগ বিশেষজ্ঞ" },
  { name: "Neurology", nameBn: "নিউরোলজি বিশেষজ্ঞ" },
  { name: "Pediatrics", nameBn: "শিশু বিশেষজ্ঞ" },
  { name: "Medicine", nameBn: "মেডিসিন বিশেষজ্ঞ" },
  { name: "Gynecology & Obstetrics", nameBn: "গাইনি ও প্রসূতি" },
  { name: "Orthopedics", nameBn: "হাড় ও জোড়া বিশেষজ্ঞ" },
  { name: "Dermatology", nameBn: "চর্মরোগ বিশেষজ্ঞ" },
  { name: "ENT", nameBn: "নাক-কান-গলা বিশেষজ্ঞ" },
  { name: "Ophthalmology", nameBn: "চক্ষু বিশেষজ্ঞ" },
  { name: "Gastroenterology", nameBn: "পাকস্থলী ও লিভার" },
  { name: "Nephrology", nameBn: "কিডনি বিশেষজ্ঞ" },
  { name: "Psychiatry", nameBn: "মানসিক রোগ বিশেষজ্ঞ" },
  { name: "Surgery", nameBn: "সার্জন" },
  { name: "Dentistry", nameBn: "দন্ত চিকিৎসক" },
  { name: "Oncology", nameBn: "ক্যান্সার বিশেষজ্ঞ" },
];

// ------------------------------------------------------------
// Sample Bangladesh locations (hospitals) — Dhaka division focus
// ------------------------------------------------------------
const sampleHospitals = [
  {
    name: "Dhaka Medical College Hospital",
    address: "East Adabor, Dhaka 1207",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    phone: "+88029661051",
  },
  {
    name: "Square Hospital Ltd",
    address: "18/F, Bir Uttam Qazi Nuruzzaman Sarak, West Panthapath, Dhaka 1205",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    phone: "+88028153345",
  },
  {
    name: "United Hospital Limited",
    address: "Plot 15, Road 71, Gulshan 2, Dhaka 1212",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    phone: "+88028836001",
  },
  {
    name: "BIRDEM General Hospital",
    address: "122 Kazi Nazrul Islam Avenue, Shahbag, Dhaka 1000",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    phone: "+88029661551",
  },
];

// ------------------------------------------------------------
// Bangladesh divisions (for reference data / future use)
// ------------------------------------------------------------
const divisions = [
  "Dhaka",
  "Chattogram",
  "Rajshahi",
  "Khulna",
  "Barishal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
];

async function main() {
  console.log("🌱 Seeding Go Dr database…");

  // 1. Specialties
  console.log("  → Specialties");
  for (const s of specialties) {
    await prisma.specialty.upsert({
      where: { slug: slugify(s.name) },
      update: { nameBn: s.nameBn },
      create: {
        name: s.name,
        nameBn: s.nameBn,
        slug: slugify(s.name),
      },
    });
  }

  // 2. Sample hospitals
  console.log("  → Sample hospitals");
  for (const h of sampleHospitals) {
    await prisma.hospital.upsert({
      where: { slug: slugify(h.name) },
      update: {},
      create: {
        name: h.name,
        slug: slugify(h.name),
        address: h.address,
        city: h.city,
        district: h.district,
        division: h.division,
        phone: h.phone,
        isActive: true,
      },
    });
  }

  // 3. Development admin (hashed password)
  console.log("  → Development admin account");
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@godr.bd";
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? "01700000000";
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeAdmin123!";
  const passwordHash = await hashPassword(adminPassword);

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      email: adminEmail,
      passwordHash,
      role: UserRole.admin,
      isVerified: true,
      isActive: true,
    },
    create: {
      fullName: process.env.SEED_ADMIN_NAME ?? "System Administrator",
      email: adminEmail,
      phone: adminPhone,
      passwordHash,
      role: UserRole.admin,
      isVerified: true,
      isActive: true,
    },
  });

  console.log(`✅ Seed complete.`);
  console.log(`   Admin login → phone: ${adminPhone} | email: ${adminEmail}`);
  console.log(`   (Password hashed with bcrypt; never stored in plaintext.)`);
  console.log(`   Reference: ${divisions.length} Bangladesh divisions documented.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
