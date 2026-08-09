import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeRequest,
  parseJson,
  createUser,
  createVerifiedDoctor,
  cleanupUsers,
  cleanupHospitals,
  cleanupSpecialties,
  resetRateLimit,
  uniquePhone,
  uniqueEmail,
} from "@tests/helpers/api";
import { GET as specialtiesList } from "@/app/api/v1/specialties/route";
import { GET as specialtyByParam } from "@/app/api/v1/specialties/[param]/route";
import { GET as specialtiesAdmin, POST as specialtyCreate } from "@/app/api/v1/admin/specialties/route";
import { PATCH as specialtyUpdate, DELETE as specialtyDelete } from "@/app/api/v1/admin/specialties/[id]/route";
import { GET as doctorsSearch } from "@/app/api/v1/doctors/route";
import { GET as doctorDetail } from "@/app/api/v1/doctors/[id]/route";
import { GET as adminDoctorsList } from "@/app/api/v1/admin/doctors/route";
import { PATCH as adminDoctorUpdate } from "@/app/api/v1/admin/doctors/[id]/route";
import { PATCH as doctorVerify } from "@/app/api/v1/admin/doctors/[id]/verify/route";
import { GET as hospitalsSearch } from "@/app/api/v1/hospitals/route";
import { GET as hospitalByParam } from "@/app/api/v1/hospitals/[param]/route";
import { GET as adminHospitalsList, POST as hospitalCreate } from "@/app/api/v1/admin/hospitals/route";
import { PATCH as hospitalUpdate, DELETE as hospitalDelete } from "@/app/api/v1/admin/hospitals/[id]/route";
import { GET as chambersList } from "@/app/api/v1/chambers/route";
import { GET as myChambers, POST as chamberCreate } from "@/app/api/v1/doctors/me/chambers/route";
import { PATCH as chamberUpdate, DELETE as chamberDelete } from "@/app/api/v1/doctors/me/chambers/[id]/route";

const BASE = "http://localhost:3000";

describe("Phase 2 — Specialties", () => {
  beforeAll(async () => {
    await resetRateLimit();
  });
  beforeEach(async () => {
    await resetRateLimit();
  });

  it("public list returns active specialties with pagination meta", async () => {
    const res = await specialtiesList(makeRequest(`${BASE}/api/v1/specialties?page=1&limit=5`));
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.specialties)).toBe(true);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(5);
  });

  it("returns a specialty by id (public)", async () => {
    const first = await prisma.specialty.findFirst({ where: { isActive: true, slug: "cardiology" } });
    expect(first).toBeTruthy();
    const res = await specialtyByParam(
      makeRequest(`${BASE}/api/v1/specialties/${first!.id}`),
      { params: { param: first!.id.toString() } },
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.specialty.slug).toBe("cardiology");
    expect(body.data.specialty.deletedAt).toBeUndefined();
  });

  it("returns a specialty by slug (public)", async () => {
    const res = await specialtyByParam(
      makeRequest(`${BASE}/api/v1/specialties/cardiology`),
      { params: { param: "cardiology" } },
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.specialty.name).toBe("Cardiology");
  });

  it("404 when specialty slug not found", async () => {
    const res = await specialtyByParam(
      makeRequest(`${BASE}/api/v1/specialties/nope-nope`),
      { params: { param: "nope-nope" } },
    );
    expect(res.status).toBe(404);
  });

  it("admin can create a specialty", async () => {
    const { user, accessToken } = await createUser({ role: "admin", isVerified: true });
    const name = `TestSpec-${Date.now()}`;
    const res = await specialtyCreate(
      makeRequest(`${BASE}/api/v1/admin/specialties`, {
        method: "POST",
        token: accessToken,
        body: { name, nameBn: "টেস্ট", icon: "test" },
      }),
    );
    const body = await parseJson(res);
    expect(res.status).toBe(201);
    expect(body.data.specialty.name).toBe(name);
    expect(body.data.specialty.slug).toBeTruthy();
    await cleanupSpecialties([BigInt(body.data.specialty.id)]);
    await cleanupUsers([user.id]);
  });

  it("unauthorized create is rejected (401)", async () => {
    const res = await specialtyCreate(
      makeRequest(`${BASE}/api/v1/admin/specialties`, {
        method: "POST",
        body: { name: "ShouldFail" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("non-admin (doctor) create is rejected (403)", async () => {
    const { user, accessToken } = await createUser({ role: "doctor", isVerified: true });
    const res = await specialtyCreate(
      makeRequest(`${BASE}/api/v1/admin/specialties`, {
        method: "POST",
        token: accessToken,
        body: { name: "ShouldFail" },
      }),
    );
    expect(res.status).toBe(403);
    await cleanupUsers([user.id]);
  });

  it("admin can update + soft-delete a specialty", async () => {
    const { user, accessToken } = await createUser({ role: "admin", isVerified: true });
    const created = await prisma.specialty.create({
      data: { name: `DelSpec-${Date.now()}`, slug: `delspec-${Date.now()}` },
    });
    const patchRes = await specialtyUpdate(
      makeRequest(`${BASE}/api/v1/admin/specialties/${created.id}`, {
        method: "PATCH",
        token: accessToken,
        body: { isActive: false },
      }),
      { params: { id: created.id.toString() } },
    );
    expect(patchRes.status).toBe(200);
    const patched = await parseJson(patchRes);
    expect(patched.data.specialty.isActive).toBe(false);

    const delRes = await specialtyDelete(
      makeRequest(`${BASE}/api/v1/admin/specialties/${created.id}`, {
        method: "DELETE",
        token: accessToken,
      }),
      { params: { id: created.id.toString() } },
    );
    expect(delRes.status).toBe(200);
    const gone = await prisma.specialty.findUnique({ where: { id: created.id } });
    expect(gone?.deletedAt).not.toBeNull();
    await cleanupSpecialties([created.id]);
    await cleanupUsers([user.id]);
  });
});

describe("Phase 2 — Doctor search & profiles", () => {
  let doctorA: Awaited<ReturnType<typeof createVerifiedDoctor>>;
  let doctorB: Awaited<ReturnType<typeof createVerifiedDoctor>>;

  beforeAll(async () => {
    await resetRateLimit();
    doctorA = await createVerifiedDoctor({
      fullName: "SearchDoc Alpha",
      phone: uniquePhone(),
      email: uniqueEmail(),
      bmdcRegNo: `BMDC-A-${Date.now().toString().slice(-6)}`,
      experienceYears: 10,
      consultationFee: 600,
      specialtySlug: "cardiology",
      chamberDistrict: "Chattogram",
      chamberCity: "Chattogram",
    });
    doctorB = await createVerifiedDoctor({
      fullName: "SearchDoc Beta",
      phone: uniquePhone(),
      email: uniqueEmail(),
      bmdcRegNo: `BMDC-B-${Date.now().toString().slice(-6)}`,
      experienceYears: 20,
      consultationFee: 1200,
      specialtySlug: "neurology",
      chamberDistrict: "Dhaka",
      chamberCity: "Dhaka",
    });
  });

  beforeEach(async () => {
    await resetRateLimit();
  });

  afterAll(async () => {
    await cleanupUsers([doctorA.user.id, doctorB.user.id]);
  });

  it("public list returns verified doctors only", async () => {
    const res = await doctorsSearch(makeRequest(`${BASE}/api/v1/doctors?limit=50`));
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Both test doctors should appear.
    const names = body.data.doctors.map((d: any) => d.name);
    expect(names).toContain("SearchDoc Alpha");
    expect(names).toContain("SearchDoc Beta");
    // Never exposes sensitive fields.
    body.data.doctors.forEach((d: any) => {
      expect(d.passwordHash).toBeUndefined();
      expect(d.phone).toBeUndefined();
      expect(d.email).toBeUndefined();
    });
  });

  it("filters by specialty slug", async () => {
    const res = await doctorsSearch(makeRequest(`${BASE}/api/v1/doctors?specialtySlug=cardiology&limit=50`));
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    const names = body.data.doctors.map((d: any) => d.name);
    expect(names).toContain("SearchDoc Alpha");
    expect(names).not.toContain("SearchDoc Beta");
  });

  it("filters by district (Chattogram consistency)", async () => {
    const res = await doctorsSearch(makeRequest(`${BASE}/api/v1/doctors?district=Chattogram&limit=50`));
    const body = await parseJson(res);
    const names = body.data.doctors.map((d: any) => d.name);
    expect(names).toContain("SearchDoc Alpha");
  });

  it("filters by min experience", async () => {
    const res = await doctorsSearch(makeRequest(`${BASE}/api/v1/doctors?minExperience=15&limit=50`));
    const body = await parseJson(res);
    const names = body.data.doctors.map((d: any) => d.name);
    expect(names).toContain("SearchDoc Beta");
    expect(names).not.toContain("SearchDoc Alpha");
  });

  it("filters by max fee", async () => {
    const res = await doctorsSearch(makeRequest(`${BASE}/api/v1/doctors?maxFee=700&limit=50`));
    const body = await parseJson(res);
    const names = body.data.doctors.map((d: any) => d.name);
    expect(names).toContain("SearchDoc Alpha");
    expect(names).not.toContain("SearchDoc Beta");
  });

  it("paginates results", async () => {
    const res = await doctorsSearch(makeRequest(`${BASE}/api/v1/doctors?page=1&limit=1`));
    const body = await parseJson(res);
    expect(body.data.doctors.length).toBe(1);
    expect(body.meta.limit).toBe(1);
    expect(body.meta.total).toBeGreaterThan(1);
    expect(body.meta.totalPages).toBeGreaterThan(1);
  });

  it("returns a doctor detail by id (public)", async () => {
    const res = await doctorDetail(
      makeRequest(`${BASE}/api/v1/doctors/${doctorA.doctorId}`),
      { params: { id: doctorA.doctorId.toString() } },
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.doctor.name).toBe("SearchDoc Alpha");
    expect(body.data.doctor.specialties.length).toBeGreaterThan(0);
  });

  it("404 for unverified doctor detail (public)", async () => {
    const { user } = await createVerifiedDoctor({ fullName: "UnverifiedOne", isAvailable: true });
    // Flip to unverified.
    const doc = await prisma.doctor.findUnique({ where: { userId: user.id } });
    await prisma.doctor.update({ where: { id: doc!.id }, data: { isVerified: false } });
    const res = await doctorDetail(
      makeRequest(`${BASE}/api/v1/doctors/${doc!.id}`),
      { params: { id: doc!.id.toString() } },
    );
    expect(res.status).toBe(404);
    await cleanupUsers([user.id]);
  });

  it("doctor can update own profile (nameBn + bio)", async () => {
    const { PATCH } = await import("@/app/api/v1/doctors/me/route");
    const res = await PATCH(
      makeRequest(`${BASE}/api/v1/doctors/me`, {
        method: "PATCH",
        token: doctorA.accessToken,
        body: { nameBn: "ডাঃ আলফা", bio: "Updated bio" },
      }),
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.user.doctor.nameBn).toBe("ডাঃ আলফা");
    expect(body.data.user.doctor.bio).toBe("Updated bio");
  });

  it("doctor cannot change verification status via /me", async () => {
    const { PATCH } = await import("@/app/api/v1/doctors/me/route");
    const res = await PATCH(
      makeRequest(`${BASE}/api/v1/doctors/me`, {
        method: "PATCH",
        token: doctorA.accessToken,
        body: { isVerified: true },
      }),
    );
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    // isVerified is not in the schema -> unchanged.
    expect(body.data.user.doctor.isVerified).toBe(true);
  });

  it("admin can verify a doctor", async () => {
    const { user } = await createUser({ role: "doctor", isVerified: false });
    const doc = await prisma.doctor.findUnique({ where: { userId: user.id } });
    const admin = await createUser({ role: "admin", isVerified: true });
    const res = await doctorVerify(
      makeRequest(`${BASE}/api/v1/admin/doctors/${doc!.id}/verify`, {
        method: "PATCH",
        token: admin.accessToken,
        body: { isVerified: true },
      }),
      { params: { id: doc!.id.toString() } },
    );
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.data.doctor.isVerified).toBe(true);
    await cleanupUsers([user.id, admin.user.id]);
  });

  it("admin can activate/deactivate a doctor", async () => {
    const admin = await createUser({ role: "admin", isVerified: true });
    const res = await adminDoctorUpdate(
      makeRequest(`${BASE}/api/v1/admin/doctors/${doctorB.doctorId}`, {
        method: "PATCH",
        token: admin.accessToken,
        body: { isAvailable: false },
      }),
      { params: { id: doctorB.doctorId.toString() } },
    );
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.data.doctor.isAvailable).toBe(false);
    // restore
    await adminDoctorUpdate(
      makeRequest(`${BASE}/api/v1/admin/doctors/${doctorB.doctorId}`, {
        method: "PATCH",
        token: admin.accessToken,
        body: { isAvailable: true },
      }),
      { params: { id: doctorB.doctorId.toString() } },
    );
    await cleanupUsers([admin.user.id]);
  });
});

describe("Phase 2 — Hospitals", () => {
  let adminTok: string;
  let adminUser: any;

  beforeAll(async () => {
    await resetRateLimit();
    const a = await createUser({ role: "admin", isVerified: true });
    adminUser = a.user;
    adminTok = a.accessToken;
  });

  beforeEach(async () => {
    await resetRateLimit();
  });

  afterAll(async () => {
    await cleanupUsers([adminUser.id]);
  });

  it("public search returns active hospitals with pagination", async () => {
    const res = await hospitalsSearch(makeRequest(`${BASE}/api/v1/hospitals?page=1&limit=5`));
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data.hospitals[0].deletedAt).toBeUndefined();
  });

  it("filters by district", async () => {
    const res = await hospitalsSearch(makeRequest(`${BASE}/api/v1/hospitals?district=Chattogram`));
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    body.data.hospitals.forEach((h: any) => expect(h.district).toBe("Chattogram"));
  });

  it("returns a hospital by slug (public)", async () => {
    const res = await hospitalByParam(
      makeRequest(`${BASE}/api/v1/hospitals/square-hospital-ltd`),
      { params: { param: "square-hospital-ltd" } },
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.hospital.name).toContain("Square");
  });

  it("admin can create a hospital", async () => {
    const name = `TestHosp-${Date.now()}`;
    const res = await hospitalCreate(
      makeRequest(`${BASE}/api/v1/admin/hospitals`, {
        method: "POST",
        token: adminTok,
        body: { name, address: "123 Test Rd", city: "Dhaka", district: "Dhaka", division: "Dhaka", phone: "+88029999999" },
      }),
    );
    const body = await parseJson(res);
    expect(res.status).toBe(201);
    expect(body.data.hospital.name).toBe(name);
    await cleanupHospitals([BigInt(body.data.hospital.id)]);
  });

  it("admin can update + delete a hospital", async () => {
    const h = await prisma.hospital.create({
      data: { name: `DelHosp-${Date.now()}`, slug: `delhosp-${Date.now()}`, address: "x", isActive: true },
    });
    const patchRes = await hospitalUpdate(
      makeRequest(`${BASE}/api/v1/admin/hospitals/${h.id}`, {
        method: "PATCH",
        token: adminTok,
        body: { isActive: false },
      }),
      { params: { id: h.id.toString() } },
    );
    expect(patchRes.status).toBe(200);
    const delRes = await hospitalDelete(
      makeRequest(`${BASE}/api/v1/admin/hospitals/${h.id}`, {
        method: "DELETE",
        token: adminTok,
      }),
      { params: { id: h.id.toString() } },
    );
    expect(delRes.status).toBe(200);
    const gone = await prisma.hospital.findUnique({ where: { id: h.id } });
    expect(gone?.deletedAt).not.toBeNull();
    await cleanupHospitals([h.id]);
  });

  it("non-admin hospital create is rejected (403)", async () => {
    const { user, accessToken } = await createUser({ role: "patient" });
    const res = await hospitalCreate(
      makeRequest(`${BASE}/api/v1/admin/hospitals`, {
        method: "POST",
        token: accessToken,
        body: { name: "No", address: "x" },
      }),
    );
    expect(res.status).toBe(403);
    await cleanupUsers([user.id]);
  });
});

describe("Phase 2 — Chambers", () => {
  let docA: Awaited<ReturnType<typeof createVerifiedDoctor>>;
  let docB: Awaited<ReturnType<typeof createVerifiedDoctor>>;

  beforeAll(async () => {
    await resetRateLimit();
    docA = await createVerifiedDoctor({ fullName: "ChamberDoc A", phone: uniquePhone(), email: uniqueEmail() });
    docB = await createVerifiedDoctor({ fullName: "ChamberDoc B", phone: uniquePhone(), email: uniqueEmail() });
  });

  beforeEach(async () => {
    await resetRateLimit();
  });

  afterAll(async () => {
    await cleanupUsers([docA.user.id, docB.user.id]);
  });

  it("doctor creates own chamber", async () => {
    const res = await chamberCreate(
      makeRequest(`${BASE}/api/v1/doctors/me/chambers`, {
        method: "POST",
        token: docA.accessToken,
        body: {
          chamberName: "My Chamber",
          address: "456 Rd",
          city: "Sylhet",
          district: "Sylhet",
          visitingDays: "fri",
          startTime: "09:00",
          endTime: "13:00",
          consultationFee: 700,
        },
      }),
    );
    const body = await parseJson(res);
    expect(res.status).toBe(201);
    expect(body.data.chamber.chamberName).toBe("My Chamber");
    expect(body.data.chamber.city).toBe("Sylhet");
  });

  it("doctor lists own chambers", async () => {
    const res = await myChambers(makeRequest(`${BASE}/api/v1/doctors/me/chambers`, { token: docA.accessToken }));
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.chambers.length).toBeGreaterThan(0);
  });

  it("doctor cannot modify another doctor's chamber (ownership)", async () => {
    // docB's chamber (created in helper).
    const otherChamberId = docB.chamberId!;
    const res = await chamberUpdate(
      makeRequest(`${BASE}/api/v1/doctors/me/chambers/${otherChamberId}`, {
        method: "PATCH",
        token: docA.accessToken,
        body: { chamberName: "Hacked" },
      }),
      { params: { id: otherChamberId.toString() } },
    );
    expect(res.status).toBe(404); // not found for docA (ownership filter)
  });

  it("doctor can deactivate own chamber via DELETE", async () => {
    // Create a chamber to delete.
    const createRes = await chamberCreate(
      makeRequest(`${BASE}/api/v1/doctors/me/chambers`, {
        method: "POST",
        token: docA.accessToken,
        body: {
          chamberName: "To Delete",
          address: "x",
          visitingDays: "sat",
          startTime: "10:00",
          endTime: "12:00",
        },
      }),
    );
    const created = await parseJson(createRes);
    const id = created.data.chamber.id;
    const delRes = await chamberDelete(
      makeRequest(`${BASE}/api/v1/doctors/me/chambers/${id}`, {
        method: "DELETE",
        token: docA.accessToken,
      }),
      { params: { id } },
    );
    expect(delRes.status).toBe(200);
  });

  it("public chamber listing shows only active chambers", async () => {
    const res = await chambersList(makeRequest(`${BASE}/api/v1/chambers?doctorId=${docA.doctorId}`));
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    body.data.chambers.forEach((c: any) => expect(c.isActive).toBe(true));
  });

  it("invalid time range is rejected", async () => {
    const res = await chamberCreate(
      makeRequest(`${BASE}/api/v1/doctors/me/chambers`, {
        method: "POST",
        token: docA.accessToken,
        body: {
          chamberName: "Bad Time",
          address: "x",
          visitingDays: "sat",
          startTime: "14:00",
          endTime: "10:00", // end before start
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("missing required fields is rejected (validation)", async () => {
    const res = await chamberCreate(
      makeRequest(`${BASE}/api/v1/doctors/me/chambers`, {
        method: "POST",
        token: docA.accessToken,
        body: { chamberName: "Missing" }, // no address/visitingDays/times
      }),
    );
    expect(res.status).toBe(400);
  });
});
