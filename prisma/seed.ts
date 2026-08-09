import { PrismaClient, UserRole } from "../src/lib/generated/prisma";
import { hashPassword } from "../src/lib/password";
import { BANGLADESH_DIVISIONS, slugify } from "../src/lib/locations";

const prisma = new PrismaClient();

// ------------------------------------------------------------
// Specialties — common medical specialties in Bangladesh
// ------------------------------------------------------------
const specialties = [
  { name: "Cardiology", nameBn: "হৃদরোগ বিশেষজ্ঞ", icon: "heart" },
  { name: "Neurology", nameBn: "নিউরোলজি বিশেষজ্ঞ", icon: "brain" },
  { name: "Pediatrics", nameBn: "শিশু বিশেষজ্ঞ", icon: "baby" },
  { name: "Medicine", nameBn: "মেডিসিন বিশেষজ্ঞ", icon: "stethoscope" },
  { name: "Gynecology & Obstetrics", nameBn: "গাইনি ও প্রসূতি", icon: "venus" },
  { name: "Orthopedics", nameBn: "হাড় ও জোড়া বিশেষজ্ঞ", icon: "bone" },
  { name: "Dermatology", nameBn: "চর্মরোগ বিশেষজ্ঞ", icon: "skin" },
  { name: "ENT", nameBn: "নাক-কান-গলা বিশেষজ্ঞ", icon: "ear" },
  { name: "Ophthalmology", nameBn: "চক্ষু বিশেষজ্ঞ", icon: "eye" },
  { name: "Gastroenterology", nameBn: "পাকস্থলী ও লিভার", icon: "liver" },
  { name: "Nephrology", nameBn: "কিডনি বিশেষজ্ঞ", icon: "kidney" },
  { name: "Psychiatry", nameBn: "মানসিক রোগ বিশেষজ্ঞ", icon: "mental-health" },
  { name: "Surgery", nameBn: "সার্জন", icon: "scalpel" },
  { name: "Dentistry", nameBn: "দন্ত চিকিৎসক", icon: "tooth" },
  { name: "Oncology", nameBn: "ক্যান্সার বিশেষজ্ঞ", icon: "ribbon" },
  { name: "Urology", nameBn: "মূত্রনালী বিশেষজ্ঞ", icon: "bladder" },
  { name: "Endocrinology", nameBn: "হরমোন ও ডায়াবেটিস", icon: "hormone" },
  { name: "Pulmonology", nameBn: "ফুসফুস বিশেষজ্ঞ", icon: "lungs" },
];

// ------------------------------------------------------------
// Sample hospitals across multiple Bangladesh districts
// ------------------------------------------------------------
const sampleHospitals = [
  {
    name: "Dhaka Medical College Hospital",
    nameBn: "ঢাকা মেডিকেল কলেজ হাসপাতাল",
    address: "East Adabor, Dhaka 1207",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    phone: "+88029661051",
    email: "info@dmch.gov.bd",
    website: "https://dmch.gov.bd",
    latitude: 23.7339,
    longitude: 90.3839,
  },
  {
    name: "Square Hospital Ltd",
    nameBn: "স্কয়ার হাসপাতাল লিমিটেড",
    address: "18/F, Bir Uttam Qazi Nuruzzaman Sarak, West Panthapath, Dhaka 1205",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    phone: "+88028153345",
    email: "info@squarehospital.com",
    website: "https://www.squarehospital.com",
    latitude: 23.7536,
    longitude: 90.3842,
  },
  {
    name: "United Hospital Limited",
    nameBn: "ইউনাইটেড হাসপাতাল লিমিটেড",
    address: "Plot 15, Road 71, Gulshan 2, Dhaka 1212",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    phone: "+88028836001",
    email: "info@unitedhospitalbd.com",
    website: "https://www.unitedhospitalbd.com",
    latitude: 23.7937,
    longitude: 90.4066,
  },
  {
    name: "Chittagong Medical College Hospital",
    nameBn: "চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল",
    address: "9/Mehebub Nagar, Chattogram 4000",
    city: "Chattogram",
    district: "Chattogram",
    division: "Chattogram",
    phone: "+88031682000",
    email: "info@cmch.gov.bd",
    latitude: 22.3593,
    longitude: 91.8214,
  },
  {
    name: "Chattogram Metropolitan Hospital",
    nameBn: "চট্টগ্রাম মেট্রোপলিটন হাসপাতাল",
    address: "1909 Mehedibag, Chattogram 4100",
    city: "Chattogram",
    district: "Chattogram",
    division: "Chattogram",
    phone: "+88031655412",
    latitude: 22.3475,
    longitude: 91.8123,
  },
  {
    name: "Rajshahi Medical College Hospital",
    nameBn: "রাজশাহী মেডিকেল কলেজ হাসপাতাল",
    address: "Rajshahi Medical College Campus, Rajshahi 6203",
    city: "Rajshahi",
    district: "Rajshahi",
    division: "Rajshahi",
    phone: "+88072177000",
    latitude: 24.3745,
    longitude: 88.6042,
  },
  {
    name: "Sylhet MAG Osmani Medical College Hospital",
    nameBn: "সিলেট এম এ জি ওসমানী মেডিকেল কলেজ হাসপাতাল",
    address: "Osmani Medical College Road, Sylhet 3100",
    city: "Sylhet",
    district: "Sylhet",
    division: "Sylhet",
    phone: "+88082173000",
    latitude: 24.8949,
    longitude: 91.8687,
  },
  {
    name: "Khulna Medical College Hospital",
    nameBn: "খুলনা মেডিকেল কলেজ হাসপাতাল",
    address: "Medical College Road, Khulna 9100",
    city: "Khulna",
    district: "Khulna",
    division: "Khulna",
    phone: "+88041279000",
    latitude: 22.8160,
    longitude: 89.5602,
  },
];

// ------------------------------------------------------------
// Demo doctors — clearly marked as UNVERIFIED demo accounts.
// They are NOT verified and have a "Demo" prefix in their names
// so they can never be mistaken for real practitioners. They
// exist only to exercise the doctor-search / chamber flows.
// ------------------------------------------------------------
const demoDoctors = [
  {
    fullName: "Demo Dr. Arif Hossain",
    nameBn: "ডেমো ডা. আরিফ হোসেন",
    phone: "01710000090",
    email: "demo.arif@godr.dev",
    password: "DemoDoctor123!",
    qualification: "MBBS, FCPS (Cardiology)",
    bmdcRegNo: "DEMO-A-90001",
    experienceYears: 12,
    consultationFee: 1000,
    bio: "[DEMO] Cardiology specialist. Not a real doctor — for development testing only.",
    specialtySlug: "cardiology",
    isAvailable: true,
  },
  {
    fullName: "Demo Dr. Nadia Rahman",
    nameBn: "ডেমো ডা. নাদিয়া রহমান",
    phone: "01710000091",
    email: "demo.nadia@godr.dev",
    password: "DemoDoctor123!",
    qualification: "MBBS, FCPS (Gynecology)",
    bmdcRegNo: "DEMO-A-90002",
    experienceYears: 8,
    consultationFee: 800,
    bio: "[DEMO] Gynecology & obstetrics. Not a real doctor — for development testing only.",
    specialtySlug: "gynecology-obstetrics",
    isAvailable: true,
  },
  {
    fullName: "Demo Dr. Tanvir Ahmed",
    nameBn: "ডেমো ডা. তানভীর আহমেদ",
    phone: "01710000092",
    email: "demo.tanvir@godr.dev",
    password: "DemoDoctor123!",
    qualification: "MBBS, MD (Neurology)",
    bmdcRegNo: "DEMO-A-90003",
    experienceYears: 15,
    consultationFee: 1200,
    bio: "[DEMO] Neurology specialist. Not a real doctor — for development testing only.",
    specialtySlug: "neurology",
    isAvailable: false,
  },
];

// ------------------------------------------------------------
// Demo chambers — linked to demo doctors + seeded hospitals
// ------------------------------------------------------------
function timeOfDay(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Seeding Go Dr database…");

  // 1. Divisions + districts (Bangladesh administrative structure)
  console.log("  → Divisions & districts");
  for (const div of BANGLADESH_DIVISIONS) {
    const division = await prisma.division.upsert({
      where: { slug: slugify(div.name) },
      update: { nameBn: div.nameBn, isActive: true },
      create: {
        name: div.name,
        nameBn: div.nameBn,
        slug: slugify(div.name),
        isActive: true,
      },
    });
    for (const d of div.districts) {
      await prisma.district.upsert({
        where: { name_divisionId: { name: d.name, divisionId: division.id } },
        update: { nameBn: d.nameBn, isActive: true },
        create: {
          name: d.name,
          nameBn: d.nameBn,
          slug: slugify(d.name),
          divisionId: division.id,
          isActive: true,
        },
      });
    }
  }

  // 2. Specialties
  console.log("  → Specialties");
  for (const s of specialties) {
    await prisma.specialty.upsert({
      where: { slug: slugify(s.name) },
      update: { nameBn: s.nameBn, icon: s.icon, isActive: true },
      create: {
        name: s.name,
        nameBn: s.nameBn,
        slug: slugify(s.name),
        icon: s.icon,
        isActive: true,
      },
    });
  }

  // 3. Hospitals
  console.log("  → Hospitals");
  for (const h of sampleHospitals) {
    await prisma.hospital.upsert({
      where: { slug: slugify(h.name) },
      update: {
        nameBn: h.nameBn,
        city: h.city,
        district: h.district,
        division: h.division,
        phone: h.phone,
        ...(h.email ? { email: h.email } : {}),
        ...(h.website ? { website: h.website } : {}),
        ...(h.latitude ? { latitude: h.latitude } : {}),
        ...(h.longitude ? { longitude: h.longitude } : {}),
        isActive: true,
        deletedAt: null,
      },
      create: {
        name: h.name,
        nameBn: h.nameBn,
        slug: slugify(h.name),
        address: h.address,
        city: h.city,
        district: h.district,
        division: h.division,
        phone: h.phone,
        email: h.email,
        website: h.website,
        latitude: h.latitude,
        longitude: h.longitude,
        isActive: true,
      },
    });
  }

  // 4. Development admin (hashed password)
  console.log("  → Development admin account");
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@godr.bd";
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? "01700000000";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeAdmin123!";
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

  // 5. Demo doctors + their specialties + chambers
  //    Demo doctors are NEVER verified — isVerified stays false so
  //    they cannot be confused with real practitioners.
  console.log("  → Demo doctors (unverified, development only)");
  for (const dd of demoDoctors) {
    const passwordHashDoc = await hashPassword(dd.password);
    const user = await prisma.user.upsert({
      where: { phone: dd.phone },
      update: {
        fullName: dd.fullName,
        email: dd.email,
        passwordHash: passwordHashDoc,
        role: UserRole.doctor,
        isVerified: false, // demo doctors are never verified
        isActive: true,
      },
      create: {
        fullName: dd.fullName,
        email: dd.email,
        phone: dd.phone,
        passwordHash: passwordHashDoc,
        role: UserRole.doctor,
        isVerified: false,
        isActive: true,
      },
    });

    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {
        nameBn: dd.nameBn,
        qualification: dd.qualification,
        bmdcRegNo: dd.bmdcRegNo,
        experienceYears: dd.experienceYears,
        consultationFee: dd.consultationFee,
        bio: dd.bio,
        isVerified: false,
        isAvailable: dd.isAvailable,
        deletedAt: null,
      },
      create: {
        userId: user.id,
        nameBn: dd.nameBn,
        qualification: dd.qualification,
        bmdcRegNo: dd.bmdcRegNo,
        experienceYears: dd.experienceYears,
        consultationFee: dd.consultationFee,
        bio: dd.bio,
        isVerified: false,
        isAvailable: dd.isAvailable,
      },
    });

    // Link the doctor to their specialty.
    const specialty = await prisma.specialty.findUnique({
      where: { slug: dd.specialtySlug },
    });
    if (specialty) {
      await prisma.doctorSpecialty.upsert({
        where: { doctorId_specialtyId: { doctorId: doctor.id, specialtyId: specialty.id } },
        update: {},
        create: { doctorId: doctor.id, specialtyId: specialty.id },
      });
    }

    // Create one demo chamber per doctor (find-or-create so
    // re-running the seed does not duplicate chambers).
    const hospitalSlug =
      dd.specialtySlug === "cardiology" || dd.specialtySlug === "gynecology-obstetrics"
        ? "square-hospital-ltd"
        : dd.specialtySlug === "neurology"
          ? "dhaka-medical-college-hospital"
          : "united-hospital-limited";
    const hospital = await prisma.hospital.findUnique({ where: { slug: hospitalSlug } });

    const chamberName = `[DEMO] Chamber — ${dd.fullName}`;
    const existing = await prisma.chamber.findFirst({
      where: { doctorId: doctor.id, chamberName },
      select: { id: true },
    });
    if (!existing) {
      await prisma.chamber.create({
        data: {
          doctorId: doctor.id,
          hospitalId: hospital?.id ?? null,
          chamberName,
          address: hospital?.address ?? "Demo address, Dhaka",
          city: hospital?.city ?? "Dhaka",
          district: hospital?.district ?? "Dhaka",
          visitingDays: "sat,sun,tue,thu",
          startTime: timeOfDay(10),
          endTime: timeOfDay(14),
          slotDurationMinutes: 15,
          consultationFee: dd.consultationFee,
          isActive: dd.isAvailable,
        },
      });
    }
  }

  console.log(`✅ Seed complete.`);
  console.log(`   Admin login → phone: ${adminPhone} | email: ${adminEmail}`);
  console.log(`   (Password hashed with bcrypt; never stored in plaintext.)`);
  console.log(`   ${BANGLADESH_DIVISIONS.length} divisions, ${specialties.length} specialties, ${sampleHospitals.length} hospitals, ${demoDoctors.length} demo doctors.`);
  console.log(`   Demo doctors are UNVERIFIED & clearly labelled — not real practitioners.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
