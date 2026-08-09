import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { issueTokenPair } from "@/lib/tokens";
import {
  makeRequest,
  uniquePhone,
  uniqueEmail,
  parseJson,
  cleanupUsers,
  resetRateLimit,
} from "@tests/helpers/api";

// Route handlers under test.
import { POST as registerPost } from "@/app/api/v1/auth/register/route";
import { POST as loginPost } from "@/app/api/v1/auth/login/route";
import { POST as refreshPost } from "@/app/api/v1/auth/refresh/route";
import { POST as logoutPost } from "@/app/api/v1/auth/logout/route";
import { GET as meGet } from "@/app/api/v1/auth/me/route";
import { GET as patientGet, PATCH as patientPatch } from "@/app/api/v1/patients/me/route";
import { GET as doctorGet, PATCH as doctorPatch } from "@/app/api/v1/doctors/me/route";
import { GET as adminUsersGet } from "@/app/api/v1/admin/users/route";
import { GET as adminDoctorsGet } from "@/app/api/v1/admin/doctors/route";
import { PATCH as adminVerifyPatch } from "@/app/api/v1/admin/doctors/[id]/verify/route";

const createdUserIds: bigint[] = [];

beforeAll(async () => {
  // Ensure a dev admin exists for admin-route tests.
  await prisma.user.upsert({
    where: { phone: "01700000000" },
    update: {},
    create: {
      fullName: "Admin",
      email: "admin@godr.bd",
      phone: "01700000000",
      passwordHash: await hashPassword("ChangeMeAdmin123!"),
      role: "admin",
      isVerified: true,
      isActive: true,
    },
  });
});

beforeEach(async () => {
  await resetRateLimit();
});

afterAll(async () => {
  await cleanupUsers(createdUserIds);
  await prisma.$disconnect();
});

async function registerPatient(overrides: Record<string, unknown> = {}) {
  const phone = (overrides.phone as string | undefined) ?? uniquePhone();
  const email = (overrides.email as string | undefined) ?? uniqueEmail();
  const res = await registerPost(
    makeRequest("/api/v1/auth/register", {
      method: "POST",
      body: {
        fullName: "New Patient",
        email,
        phone,
        password: "Password123!",
        role: "patient",
        ...overrides,
      },
    }),
  );
  return { res, phone, email };
}

describe("auth: registration", () => {
  it("registers a patient successfully and returns a sanitized user + token", async () => {
    const { res } = await registerPatient();
    expect(res.status).toBe(201);
    const body = await parseJson(res);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.user.id).toBeDefined();
    // passwordHash must never be exposed.
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    // Set-cookie for refresh token.
    expect(res.headers.get("set-cookie")).toContain("godr_refresh");
    // Persist id for cleanup.
    createdUserIds.push(BigInt(body.data.user.id));
  });

  it("creates a patient profile during registration", async () => {
    const { res } = await registerPatient();
    const body = await parseJson(res);
    createdUserIds.push(BigInt(body.data.user.id));
    const patient = await prisma.patient.findFirst({
      where: { userId: BigInt(body.data.user.id) },
    });
    expect(patient).not.toBeNull();
  });

  it("registers a doctor and creates a doctor profile", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const res = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "New Doctor", email, phone, password: "Password123!", role: "doctor" },
      }),
    );
    expect(res.status).toBe(201);
    const body = await parseJson(res);
    createdUserIds.push(BigInt(body.data.user.id));
    const doctor = await prisma.doctor.findFirst({
      where: { userId: BigInt(body.data.user.id) },
    });
    expect(doctor).not.toBeNull();
  });

  it("rejects a duplicate phone with 409", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const { res: first } = await registerPatient({ phone, email });
    createdUserIds.push(BigInt((await parseJson(first)).data.user.id));

    const dup = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Dup", email: uniqueEmail(), phone, password: "Password123!", role: "patient" },
      }),
    );
    expect(dup.status).toBe(409);
  });

  it("rejects a duplicate email with 409", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const { res: first } = await registerPatient({ phone, email });
    createdUserIds.push(BigInt((await parseJson(first)).data.user.id));

    const dup = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Dup", email, phone: uniquePhone(), password: "Password123!", role: "patient" },
      }),
    );
    expect(dup.status).toBe(409);
  });

  it("rejects an invalid password (missing complexity)", async () => {
    const res = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "X", email: uniqueEmail(), phone: uniquePhone(), password: "short", role: "patient" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid Bangladeshi phone", async () => {
    const res = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "X", email: uniqueEmail(), phone: "12345", password: "Password123!", role: "patient" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("auth: login", () => {
  it("logs in successfully with phone + password and returns an access token", async () => {
    const phone = uniquePhone();
    const password = "Password123!";
    const { res: reg } = await registerPatient({ phone, password });
    createdUserIds.push(BigInt((await parseJson(reg)).data.user.id));

    const res = await loginPost(
      makeRequest("/api/v1/auth/login", { method: "POST", body: { identifier: phone, password } }),
    );
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.user.phone).toBe(phone);
  });

  it("logs in successfully with email + password", async () => {
    const email = uniqueEmail();
    const password = "Password123!";
    const { res: reg } = await registerPatient({ email, password });
    createdUserIds.push(BigInt((await parseJson(reg)).data.user.id));

    const res = await loginPost(
      makeRequest("/api/v1/auth/login", { method: "POST", body: { identifier: email, password } }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects a wrong password with 401", async () => {
    const phone = uniquePhone();
    const { res: reg } = await registerPatient({ phone });
    createdUserIds.push(BigInt((await parseJson(reg)).data.user.id));

    const res = await loginPost(
      makeRequest("/api/v1/auth/login", { method: "POST", body: { identifier: phone, password: "WrongPass123!" } }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a non-existent user with 401 (no user enumeration)", async () => {
    const res = await loginPost(
      makeRequest("/api/v1/auth/login", { method: "POST", body: { identifier: uniquePhone(), password: "Password123!" } }),
    );
    expect(res.status).toBe(401);
    const body = await parseJson(res);
    expect(body.error.message).toBe("Invalid credentials");
  });
});

describe("auth: protected endpoints", () => {
  it("rejects /me without a token with 401", async () => {
    const res = await meGet(makeRequest("/api/v1/auth/me"));
    expect(res.status).toBe(401);
  });

  it("returns the current user with a valid token", async () => {
    const phone = uniquePhone();
    const { res: reg } = await registerPatient({ phone });
    const regBody = await parseJson(reg);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const res = await meGet(makeRequest("/api/v1/auth/me", { token: regBody.data.accessToken }));
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.data.user.phone).toBe(phone);
  });
});

describe("ownership protection: patient", () => {
  it("allows a patient to fetch their own profile", async () => {
    const { res: reg } = await registerPatient();
    const regBody = await parseJson(reg);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const res = await patientGet(makeRequest("/api/v1/patients/me", { token: regBody.data.accessToken }));
    expect(res.status).toBe(200);
  });

  it("allows a patient to update their own profile", async () => {
    const { res: reg } = await registerPatient();
    const regBody = await parseJson(reg);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const res = await patientPatch(
      makeRequest("/api/v1/patients/me", {
        method: "PATCH",
        token: regBody.data.accessToken,
        body: { fullName: "Updated Name", bloodGroup: "O_POSITIVE" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.data.user.fullName).toBe("Updated Name");
  });

  it("forbids a doctor from accessing patient routes (403)", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const res = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Doc", email, phone, password: "Password123!", role: "doctor" },
      }),
    );
    const body = await parseJson(res);
    createdUserIds.push(BigInt(body.data.user.id));

    const patientRes = await patientGet(makeRequest("/api/v1/patients/me", { token: body.data.accessToken }));
    expect(patientRes.status).toBe(403);
  });
});

describe("ownership protection: doctor", () => {
  it("allows a doctor to fetch their own profile", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const res = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Doc", email, phone, password: "Password123!", role: "doctor" },
      }),
    );
    const body = await parseJson(res);
    createdUserIds.push(BigInt(body.data.user.id));

    const getRes = await doctorGet(makeRequest("/api/v1/doctors/me", { token: body.data.accessToken }));
    expect(getRes.status).toBe(200);
  });

  it("allows a doctor to update BMDC and profile fields", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const res = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Doc", email, phone, password: "Password123!", role: "doctor" },
      }),
    );
    const body = await parseJson(res);
    createdUserIds.push(BigInt(body.data.user.id));

    const patchRes = await doctorPatch(
      makeRequest("/api/v1/doctors/me", {
        method: "PATCH",
        token: body.data.accessToken,
        body: { bmdcRegNo: "A-12345", qualification: "MBBS", consultationFee: 800 },
      }),
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await parseJson(patchRes);
    expect(patchBody.data.user.doctor.bmdcRegNo).toBe("A-12345");
  });

  it("does NOT allow a doctor to self-verify (isVerified not in schema)", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const res = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Doc", email, phone, password: "Password123!", role: "doctor" },
      }),
    );
    const body = await parseJson(res);
    createdUserIds.push(BigInt(body.data.user.id));

    const patchRes = await doctorPatch(
      makeRequest("/api/v1/doctors/me", {
        method: "PATCH",
        token: body.data.accessToken,
        body: { isVerified: true },
      }),
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await parseJson(patchRes);
    // isVerified unchanged — still false.
    expect(patchBody.data.user.doctor.isVerified).toBe(false);
  });

  it("forbids a patient from accessing doctor routes (403)", async () => {
    const { res: reg } = await registerPatient();
    const regBody = await parseJson(reg);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const res = await doctorGet(makeRequest("/api/v1/doctors/me", { token: regBody.data.accessToken }));
    expect(res.status).toBe(403);
  });
});

describe("role protection: admin", () => {
  async function adminToken() {
    const admin = await prisma.user.findUnique({ where: { phone: "01700000000" } });
    const { accessToken } = await issueTokenPair(admin!);
    return accessToken;
  }

  it("forbids a patient from accessing admin/users (403)", async () => {
    const { res: reg } = await registerPatient();
    const regBody = await parseJson(reg);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const res = await adminUsersGet(makeRequest("/api/v1/admin/users", { token: regBody.data.accessToken }));
    expect(res.status).toBe(403);
  });

  it("allows admin to list users", async () => {
    const token = await adminToken();
    const res = await adminUsersGet(makeRequest("/api/v1/admin/users", { token }));
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(Array.isArray(body.data.users)).toBe(true);
    expect(body.meta.total).toBeGreaterThan(0);
  });

  it("allows admin to list doctors", async () => {
    const token = await adminToken();
    const res = await adminDoctorsGet(makeRequest("/api/v1/admin/doctors", { token }));
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(Array.isArray(body.data.doctors)).toBe(true);
  });

  it("allows admin to verify a doctor", async () => {
    const token = await adminToken();
    const phone = uniquePhone();
    const email = uniqueEmail();
    const regRes = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Doc", email, phone, password: "Password123!", role: "doctor" },
      }),
    );
    const regBody = await parseJson(regRes);
    createdUserIds.push(BigInt(regBody.data.user.id));
    const doctor = await prisma.doctor.findFirst({ where: { userId: BigInt(regBody.data.user.id) } });
    expect(doctor!.isVerified).toBe(false);

    const verifyRes = await adminVerifyPatch(
      makeRequest(`/api/v1/admin/doctors/${doctor!.id}/verify`, {
        method: "PATCH",
        token,
        body: { isVerified: true },
      }),
      { params: { id: doctor!.id.toString() } },
    );
    expect(verifyRes.status).toBe(200);
    const refreshed = await prisma.doctor.findUnique({ where: { id: doctor!.id } });
    expect(refreshed!.isVerified).toBe(true);
  });

  it("allows admin to unverify a doctor", async () => {
    const token = await adminToken();
    const phone = uniquePhone();
    const email = uniqueEmail();
    const regRes = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Doc", email, phone, password: "Password123!", role: "doctor" },
      }),
    );
    const regBody = await parseJson(regRes);
    createdUserIds.push(BigInt(regBody.data.user.id));
    const doctor = await prisma.doctor.findFirst({ where: { userId: BigInt(regBody.data.user.id) } });
    await prisma.doctor.update({ where: { id: doctor!.id }, data: { isVerified: true } });

    const verifyRes = await adminVerifyPatch(
      makeRequest(`/api/v1/admin/doctors/${doctor!.id}/verify`, {
        method: "PATCH",
        token,
        body: { isVerified: false },
      }),
      { params: { id: doctor!.id.toString() } },
    );
    expect(verifyRes.status).toBe(200);
    const refreshed = await prisma.doctor.findUnique({ where: { id: doctor!.id } });
    expect(refreshed!.isVerified).toBe(false);
  });

  it("forbids a doctor from verifying another doctor (403)", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const res = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Doc", email, phone, password: "Password123!", role: "doctor" },
      }),
    );
    const body = await parseJson(res);
    createdUserIds.push(BigInt(body.data.user.id));

    const verifyRes = await adminVerifyPatch(
      makeRequest(`/api/v1/admin/doctors/1/verify`, {
        method: "PATCH",
        token: body.data.accessToken,
        body: { isVerified: true },
      }),
      { params: { id: "1" } },
    );
    expect(verifyRes.status).toBe(403);
  });
});

describe("refresh token flow", () => {
  it("rotates a refresh token and issues a new access token", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const regRes = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Test User", email, phone, password: "Password123!", role: "patient" },
      }),
    );
    const regBody = await parseJson(regRes);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const loginRes = await loginPost(
      makeRequest("/api/v1/auth/login", { method: "POST", body: { identifier: phone, password: "Password123!" } }),
    );
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const match = /godr_refresh=([^;]+)/.exec(setCookie);
    expect(match).not.toBeNull();
    const refreshToken = match![1]!;

    // Send the refresh token as a cookie (httpOnly in production).
    const refreshRes = await refreshPost(
      makeRequest("/api/v1/auth/refresh", { method: "POST", cookie: `godr_refresh=${refreshToken}` }),
    );
    expect(refreshRes.status).toBe(200);
    const refreshBody = await parseJson(refreshRes);
    expect(refreshBody.data.accessToken).toBeTruthy();
  });

  it("rejects a reused (already-rotated) refresh token", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const regRes = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Test User", email, phone, password: "Password123!", role: "patient" },
      }),
    );
    const regBody = await parseJson(regRes);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const loginRes = await loginPost(
      makeRequest("/api/v1/auth/login", { method: "POST", body: { identifier: phone, password: "Password123!" } }),
    );
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const refreshToken = /godr_refresh=([^;]+)/.exec(setCookie)![1]!;

    // First refresh succeeds.
    const first = await refreshPost(
      makeRequest("/api/v1/auth/refresh", { method: "POST", cookie: `godr_refresh=${refreshToken}` }),
    );
    expect(first.status).toBe(200);

    // Reusing the same (now-revoked) token must fail.
    const second = await refreshPost(
      makeRequest("/api/v1/auth/refresh", { method: "POST", cookie: `godr_refresh=${refreshToken}` }),
    );
    expect(second.status).toBe(401);
  });
});

describe("logout / revocation", () => {
  it("logs out and revokes the refresh token", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const regRes = await registerPost(
      makeRequest("/api/v1/auth/register", {
        method: "POST",
        body: { fullName: "Test User", email, phone, password: "Password123!", role: "patient" },
      }),
    );
    const regBody = await parseJson(regRes);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const loginRes = await loginPost(
      makeRequest("/api/v1/auth/login", { method: "POST", body: { identifier: phone, password: "Password123!" } }),
    );
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const refreshToken = /godr_refresh=([^;]+)/.exec(setCookie)![1]!;

    const logoutRes = await logoutPost(
      makeRequest("/api/v1/auth/logout", {
        method: "POST",
        token: regBody.data.accessToken,
        cookie: `godr_refresh=${refreshToken}`,
      }),
    );
    expect(logoutRes.status).toBe(200);

    // The revoked token can no longer be refreshed.
    const refreshRes = await refreshPost(
      makeRequest("/api/v1/auth/refresh", { method: "POST", cookie: `godr_refresh=${refreshToken}` }),
    );
    expect(refreshRes.status).toBe(401);
  });
});

describe("security: no password_hash exposure", () => {
  it("never includes passwordHash in any auth response", async () => {
    const phone = uniquePhone();
    const { res: reg } = await registerPatient({ phone });
    const regBody = await parseJson(reg);
    createdUserIds.push(BigInt(regBody.data.user.id));

    const loginRes = await loginPost(
      makeRequest("/api/v1/auth/login", { method: "POST", body: { identifier: phone, password: "Password123!" } }),
    );
    const loginBody = await parseJson(loginRes);

    const meRes = await meGet(makeRequest("/api/v1/auth/me", { token: regBody.data.accessToken }));
    const meBody = await parseJson(meRes);

    expect(JSON.stringify(regBody)).not.toContain("passwordHash");
    expect(JSON.stringify(loginBody)).not.toContain("passwordHash");
    expect(JSON.stringify(meBody)).not.toContain("passwordHash");
  });
});
