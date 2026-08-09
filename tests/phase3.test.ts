/**
 * Phase 3 — Appointment & Slot Booking System integration tests.
 *
 * Exercises the real route handlers against the real test database
 * (no mocks). Covers slot generation, booking, double-booking race
 * protection, RBAC, status transitions, cancellation rules, filters,
 * pagination, and validation.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  makeRequest,
  parseJson,
  createUser,
  createVerifiedDoctor,
  createChamberForDoctor,
  cleanupAppointments,
  cleanupChambers,
  cleanupUsers,
  resetRateLimit,
  futureDateOnWeekday,
} from "@tests/helpers/api";
import { GET as slotsGet } from "@/app/api/v1/chambers/[chamberId]/slots/route";
import { POST as bookAppointment, GET as adminListAppointments } from "@/app/api/v1/appointments/route";
import { GET as myAppointments, } from "@/app/api/v1/appointments/my/route";
import { GET as patientApptGet, PATCH as patientApptPatch } from "@/app/api/v1/appointments/[id]/route";
import { GET as doctorAppointmentsGet } from "@/app/api/v1/doctor/appointments/route";
import { GET as doctorApptGet, PATCH as doctorApptPatch } from "@/app/api/v1/doctor/appointments/[id]/route";
import { GET as adminApptsList } from "@/app/api/v1/admin/appointments/route";
import { GET as adminApptGet, PATCH as adminApptPatch } from "@/app/api/v1/admin/appointments/[id]/route";

const BASE = "http://localhost:3000/api/v1";

// Saturday = 6. The default test chamber visits sat,sun,tue,thu.
const FUTURE_SAT = futureDateOnWeekday(6);

interface Suite {
  patientToken: string;
  patientId: bigint;
  patient2Token: string;
  patient2Id: bigint;
  doctorToken: string;
  doctorId: bigint;
  doctor2Token: string;
  doctor2Id: bigint;
  adminToken: string;
  chamberId: bigint;
  createdAppointmentIds: bigint[];
  createdChamberIds: bigint[];
  createdUserIds: bigint[];
}

let s: Suite;

async function buildSuite(): Promise<Suite> {
  const patient = await createUser({ role: "patient", fullName: "P1" });
  const patient2 = await createUser({ role: "patient", fullName: "P2" });
  const doc = await createVerifiedDoctor({ fullName: "Doc1", consultationFee: 700 });
  const doc2 = await createVerifiedDoctor({ fullName: "Doc2" });
  const admin = await createUser({ role: "admin", fullName: "Admin" });

  const patientRecord = await prisma.patient.findFirstOrThrow({ where: { userId: patient.user.id } });
  const patient2Record = await prisma.patient.findFirstOrThrow({ where: { userId: patient2.user.id } });

  const chamberId = await createChamberForDoctor(doc.doctorId, {
    visitingDays: "sat,sun,tue,thu",
    startTimeHour: 10,
    endTimeHour: 12,
    slotDurationMinutes: 20,
    consultationFee: 700,
  });

  return {
    patientToken: patient.accessToken,
    patientId: patientRecord.id,
    patient2Token: patient2.accessToken,
    patient2Id: patient2Record.id,
    doctorToken: doc.accessToken,
    doctorId: doc.doctorId,
    doctor2Token: doc2.accessToken,
    doctor2Id: doc2.doctorId,
    adminToken: admin.accessToken,
    chamberId,
    createdAppointmentIds: [],
    createdChamberIds: [chamberId, doc2.chamberId!].filter(Boolean) as bigint[],
    createdUserIds: [patient.user.id, patient2.user.id, doc.user.id, doc2.user.id, admin.user.id],
  };
}

beforeEach(async () => {
  await resetRateLimit();
  s = await buildSuite();
});

afterEach(async () => {
  await cleanupAppointments(s.createdAppointmentIds);
  await cleanupChambers(s.createdChamberIds);
  await cleanupUsers(s.createdUserIds);
});

describe("Phase 3 — Slots", () => {
  it("returns the slot grid for a visiting day", async () => {
    const req = makeRequest(`${BASE}/chambers/${s.chamberId}/slots?date=${FUTURE_SAT}`);
    const res = await slotsGet(req, { params: { chamberId: s.chamberId.toString() } });
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.date).toBe(FUTURE_SAT);
    expect(body.data.slots.length).toBe(6); // 10:00-12:00, 20-min slots
    expect(body.data.slots[0]).toMatchObject({ startTime: "10:00", endTime: "10:20", available: true });
    expect(body.data.slots[5]).toMatchObject({ startTime: "11:40", endTime: "12:00" });
  });

  it("returns no slots on a non-visiting day", async () => {
    // Friday = 5, not in sat,sun,tue,thu
    const friday = futureDateOnWeekday(5);
    const req = makeRequest(`${BASE}/chambers/${s.chamberId}/slots?date=${friday}`);
    const res = await slotsGet(req, { params: { chamberId: s.chamberId.toString() } });
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.slots).toEqual([]);
  });

  it("returns 404 for an inactive chamber", async () => {
    const inactiveId = await createChamberForDoctor(s.doctorId, { isActive: false });
    s.createdChamberIds.push(inactiveId);
    const req = makeRequest(`${BASE}/chambers/${inactiveId}/slots?date=${FUTURE_SAT}`);
    const res = await slotsGet(req, { params: { chamberId: inactiveId.toString() } });
    expect(res.status).toBe(404);
  });

  it("rejects malformed dates", async () => {
    const req = makeRequest(`${BASE}/chambers/${s.chamberId}/slots?date=not-a-date`);
    const res = await slotsGet(req, { params: { chamberId: s.chamberId.toString() } });
    expect(res.status).toBe(400);
  });
});

describe("Phase 3 — Booking", () => {
  it("patient successfully books an available slot", async () => {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "10:00", patientProblem: "Fever" },
    });
    const res = await bookAppointment(req);
    const body = await parseJson(res);
    expect(res.status).toBe(201);
    expect(body.data.appointment.appointmentNumber).toMatch(/^APT-\d{4}-\d{6}$/);
    expect(body.data.appointment.status).toBe("PENDING");
    expect(body.data.appointment.consultationFee).toBe("700");
    expect(body.data.appointment.doctorId).toBe(s.doctorId.toString());
    expect(body.data.appointment.patientId).toBe(s.patientId.toString());
    expect(body.data.appointment.serialNo).toBe(1);
    s.createdAppointmentIds.push(BigInt(body.data.appointment.id));
  });

  it("unauthenticated user cannot book", async () => {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "10:00" },
    });
    const res = await bookAppointment(req);
    expect(res.status).toBe(401);
  });

  it("doctor cannot create a patient appointment", async () => {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.doctorToken,
      body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "10:00" },
    });
    const res = await bookAppointment(req);
    expect(res.status).toBe(403);
  });

  it("cannot book outside chamber hours", async () => {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "13:00" },
    });
    const res = await bookAppointment(req);
    expect(res.status).toBe(400);
  });

  it("cannot book on a non-visiting day", async () => {
    const friday = futureDateOnWeekday(5);
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: s.chamberId.toString(), date: friday, time: "10:00" },
    });
    const res = await bookAppointment(req);
    expect(res.status).toBe(400);
  });

  it("cannot book a past date", async () => {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: s.chamberId.toString(), date: "2020-01-01", time: "10:00" },
    });
    const res = await bookAppointment(req);
    expect(res.status).toBe(400);
  });

  it("cannot book an inactive chamber", async () => {
    const inactiveId = await createChamberForDoctor(s.doctorId, { isActive: false });
    s.createdChamberIds.push(inactiveId);
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: inactiveId.toString(), date: FUTURE_SAT, time: "10:00" },
    });
    const res = await bookAppointment(req);
    expect(res.status).toBe(404);
  });

  it("cannot double-book the same slot (sequential)", async () => {
    const book = (token: string) =>
      bookAppointment(
        makeRequest(`${BASE}/appointments`, {
          method: "POST",
          token,
          body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "10:40", patientProblem: "Headache" },
        }),
      );
    const r1 = await book(s.patientToken);
    const b1 = await parseJson(r1);
    expect(r1.status).toBe(201);
    s.createdAppointmentIds.push(BigInt(b1.data.appointment.id));

    const r2 = await book(s.patient2Token);
    expect(r2.status).toBe(409);
  });

  it("concurrent booking race is handled safely", async () => {
    // Two patients race for the same slot simultaneously.
    const book = (token: string) =>
      bookAppointment(
        makeRequest(`${BASE}/appointments`, {
          method: "POST",
          token,
          body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "11:00", patientProblem: "Race condition" },
        }),
      );
    const [r1, r2] = await Promise.all([book(s.patientToken), book(s.patient2Token)]);
    const statuses = [r1.status, r2.status].sort();
    // Exactly one succeeds (201), the other gets 409.
    expect(statuses).toEqual([201, 409]);
    const winner = r1.status === 201 ? r1 : r2;
    const body = await parseJson(winner);
    s.createdAppointmentIds.push(BigInt(body.data.appointment.id));
  });

  it("appointment number is unique", async () => {
    const ids: bigint[] = [];
    const numbers = new Set<string>();
    // Book three distinct slots on the same day.
    for (const time of ["10:00", "10:20", "10:40"]) {
      const req = makeRequest(`${BASE}/appointments`, {
        method: "POST",
        token: s.patientToken,
        body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time, patientProblem: "Fever" },
      });
      const res = await bookAppointment(req);
      const body = await parseJson(res);
      expect(res.status).toBe(201);
      ids.push(BigInt(body.data.appointment.id));
      numbers.add(body.data.appointment.appointmentNumber);
    }
    expect(numbers.size).toBe(3);
    s.createdAppointmentIds.push(...ids);
  });

  it("serialNo increments per chamber+date", async () => {
    const ids: bigint[] = [];
    const serials: number[] = [];
    for (const time of ["10:00", "10:20", "10:40"]) {
      const req = makeRequest(`${BASE}/appointments`, {
        method: "POST",
        token: s.patientToken,
        body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time, patientProblem: "Fever" },
      });
      const res = await bookAppointment(req);
      const body = await parseJson(res);
      ids.push(BigInt(body.data.appointment.id));
      serials.push(body.data.appointment.serialNo);
    }
    expect(serials).toEqual([1, 2, 3]);
    s.createdAppointmentIds.push(...ids);
  });

  it("rejects invalid request bodies with 400", async () => {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: "x", date: "bad", time: "bad" },
    });
    const res = await bookAppointment(req);
    expect(res.status).toBe(400);
  });
});

describe("Phase 3 — Patient appointments", () => {
  async function bookForPatient(token: string, time = "10:00"): Promise<bigint> {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token,
      body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time, patientProblem: "Fever" },
    });
    const res = await bookAppointment(req);
    const body = await parseJson(res);
    const id = BigInt(body.data.appointment.id);
    s.createdAppointmentIds.push(id);
    return id;
  }

  it("patient sees only their own appointments", async () => {
    await bookForPatient(s.patientToken, "10:00");
    await bookForPatient(s.patient2Token, "10:20");
    const req = makeRequest(`${BASE}/appointments/my`, { token: s.patientToken });
    const res = await myAppointments(req as NextRequest);
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointments).toHaveLength(1);
    expect(body.data.appointments[0].patientId).toBe(s.patientId.toString());
  });

  it("patient can fetch their own appointment by id", async () => {
    const id = await bookForPatient(s.patientToken);
    const res = await patientApptGet(
      makeRequest(`${BASE}/appointments/${id}`, { token: s.patientToken }),
      { params: { id: id.toString() } },
    );
    expect(res.status).toBe(200);
  });

  it("patient cannot access another patient's appointment", async () => {
    const id = await bookForPatient(s.patientToken);
    const res = await patientApptGet(
      makeRequest(`${BASE}/appointments/${id}`, { token: s.patient2Token }),
      { params: { id: id.toString() } },
    );
    expect(res.status).toBe(404);
  });

  it("patient can cancel their own appointment", async () => {
    const id = await bookForPatient(s.patientToken);
    const res = await patientApptPatch(
      makeRequest(`${BASE}/appointments/${id}`, {
        method: "PATCH",
        token: s.patientToken,
        body: { cancelReason: "Feeling better" },
      }),
      { params: { id: id.toString() } },
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointment.status).toBe("CANCELLED");
    expect(body.data.appointment.cancelledAt).toBeTruthy();
  });

  it("patient cannot cancel an already cancelled appointment", async () => {
    const id = await bookForPatient(s.patientToken);
    await patientApptPatch(
      makeRequest(`${BASE}/appointments/${id}`, {
        method: "PATCH",
        token: s.patientToken,
        body: { cancelReason: "First cancel" },
      }),
      { params: { id: id.toString() } },
    );
    const res = await patientApptPatch(
      makeRequest(`${BASE}/appointments/${id}`, {
        method: "PATCH",
        token: s.patientToken,
        body: { cancelReason: "Second cancel" },
      }),
      { params: { id: id.toString() } },
    );
    expect(res.status).toBe(400);
  });
});

describe("Phase 3 — Doctor appointments", () => {
  async function bookForDoctor(time = "10:00"): Promise<bigint> {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time, patientProblem: "Fever" },
    });
    const res = await bookAppointment(req);
    const body = await parseJson(res);
    const id = BigInt(body.data.appointment.id);
    s.createdAppointmentIds.push(id);
    return id;
  }

  it("doctor sees only their own appointments", async () => {
    await bookForDoctor("10:00");
    const res = await doctorAppointmentsGet(
      makeRequest(`${BASE}/doctor/appointments`, { token: s.doctorToken }) as NextRequest,
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointments).toHaveLength(1);
    expect(body.data.appointments[0].doctorId).toBe(s.doctorId.toString());
  });

  it("doctor2 cannot see doctor1's appointments", async () => {
    await bookForDoctor("10:00");
    const res = await doctorAppointmentsGet(
      makeRequest(`${BASE}/doctor/appointments`, { token: s.doctor2Token }) as NextRequest,
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointments).toHaveLength(0);
  });

  it("doctor cannot access another doctor's appointment by id", async () => {
    const id = await bookForDoctor();
    const res = await doctorApptGet(
      makeRequest(`${BASE}/doctor/appointments/${id}`, { token: s.doctor2Token }),
      { params: { id: id.toString() } },
    );
    expect(res.status).toBe(404);
  });
});

describe("Phase 3 — Status transitions", () => {
  async function book(): Promise<bigint> {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "10:00", patientProblem: "Fever" },
    });
    const res = await bookAppointment(req);
    const body = await parseJson(res);
    const id = BigInt(body.data.appointment.id);
    s.createdAppointmentIds.push(id);
    return id;
  }

  it("valid transition PENDING -> CONFIRMED succeeds (doctor)", async () => {
    const id = await book();
    const res = await doctorApptPatch(
      makeRequest(`${BASE}/doctor/appointments/${id}`, {
        method: "PATCH",
        token: s.doctorToken,
        body: { status: "CONFIRMED" },
      }),
      { params: { id: id.toString() } },
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointment.status).toBe("CONFIRMED");
  });

  it("invalid transition PENDING -> COMPLETED fails", async () => {
    const id = await book();
    const res = await doctorApptPatch(
      makeRequest(`${BASE}/doctor/appointments/${id}`, {
        method: "PATCH",
        token: s.doctorToken,
        body: { status: "COMPLETED" },
      }),
      { params: { id: id.toString() } },
    );
    expect(res.status).toBe(400);
  });

  it("full lifecycle PENDING -> CONFIRMED -> COMPLETED works", async () => {
    const id = await book();
    await doctorApptPatch(
      makeRequest(`${BASE}/doctor/appointments/${id}`, {
        method: "PATCH",
        token: s.doctorToken,
        body: { status: "CONFIRMED" },
      }),
      { params: { id: id.toString() } },
    );
    const res = await doctorApptPatch(
      makeRequest(`${BASE}/doctor/appointments/${id}`, {
        method: "PATCH",
        token: s.doctorToken,
        body: { status: "COMPLETED", doctorNotes: "Recovered" },
      }),
      { params: { id: id.toString() } },
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointment.status).toBe("COMPLETED");
    expect(body.data.appointment.doctorNotes).toBe("Recovered");
  });

  it("doctor cannot cancel a completed appointment", async () => {
    const id = await book();
    await doctorApptPatch(
      makeRequest(`${BASE}/doctor/appointments/${id}`, {
        method: "PATCH",
        token: s.doctorToken,
        body: { status: "CONFIRMED" },
      }),
      { params: { id: id.toString() } },
    );
    await doctorApptPatch(
      makeRequest(`${BASE}/doctor/appointments/${id}`, {
        method: "PATCH",
        token: s.doctorToken,
        body: { status: "COMPLETED" },
      }),
      { params: { id: id.toString() } },
    );
    const res = await doctorApptPatch(
      makeRequest(`${BASE}/doctor/appointments/${id}`, {
        method: "PATCH",
        token: s.doctorToken,
        body: { status: "CANCELLED", cancelReason: "Done" },
      }),
      { params: { id: id.toString() } },
    );
    expect(res.status).toBe(400);
  });
});

describe("Phase 3 — Admin", () => {
  async function book(): Promise<bigint> {
    const req = makeRequest(`${BASE}/appointments`, {
      method: "POST",
      token: s.patientToken,
      body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "10:00", patientProblem: "Fever" },
    });
    const res = await bookAppointment(req);
    const body = await parseJson(res);
    const id = BigInt(body.data.appointment.id);
    s.createdAppointmentIds.push(id);
    return id;
  }

  it("admin can view appointments", async () => {
    await book();
    const res = await adminApptsList(
      makeRequest(`${BASE}/admin/appointments`, { token: s.adminToken }) as NextRequest,
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointments.length).toBeGreaterThanOrEqual(1);
    expect(body.meta.pagination).toBeDefined();
  });

  it("non-admin cannot use the admin list endpoint", async () => {
    const res = await adminApptsList(
      makeRequest(`${BASE}/admin/appointments`, { token: s.patientToken }) as NextRequest,
    );
    expect(res.status).toBe(403);
  });

  it("non-admin cannot use the top-level appointments list endpoint", async () => {
    const res = await adminListAppointments(
      makeRequest(`${BASE}/appointments`, { token: s.patientToken }) as NextRequest,
    );
    expect(res.status).toBe(403);
  });

  it("admin can filter by doctor", async () => {
    await book();
    const res = await adminApptsList(
      makeRequest(`${BASE}/admin/appointments?doctorId=${s.doctorId}`, { token: s.adminToken }) as NextRequest,
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    for (const a of body.data.appointments) {
      expect(a.doctorId).toBe(s.doctorId.toString());
    }
  });

  it("admin can manage status", async () => {
    const id = await book();
    const res = await adminApptPatch(
      makeRequest(`${BASE}/admin/appointments/${id}`, {
        method: "PATCH",
        token: s.adminToken,
        body: { status: "CONFIRMED" },
      }),
      { params: { id: id.toString() } },
    );
    expect(res.status).toBe(200);
  });
});

describe("Phase 3 — Pagination", () => {
  it("pagination works", async () => {
    // Book 3 appointments in distinct slots.
    for (const time of ["10:00", "10:20", "10:40"]) {
      const req = makeRequest(`${BASE}/appointments`, {
        method: "POST",
        token: s.patientToken,
        body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time, patientProblem: "Fever" },
      });
      const res = await bookAppointment(req);
      const body = await parseJson(res);
      s.createdAppointmentIds.push(BigInt(body.data.appointment.id));
    }
    const res = await myAppointments(
      makeRequest(`${BASE}/appointments/my?limit=2&page=1`, { token: s.patientToken }),
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointments).toHaveLength(2);
    expect(body.meta.pagination.total).toBe(3);
    expect(body.meta.pagination.totalPages).toBe(2);
  });

  it("filters work (by status)", async () => {
    // Book + cancel one, book one active.
    const r1 = await bookAppointment(
      makeRequest(`${BASE}/appointments`, {
        method: "POST",
        token: s.patientToken,
        body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "10:00", patientProblem: "Fever" },
      }),
    );
    const b1 = await parseJson(r1);
    s.createdAppointmentIds.push(BigInt(b1.data.appointment.id));
    await patientApptPatch(
      makeRequest(`${BASE}/appointments/${b1.data.appointment.id}`, {
        method: "PATCH",
        token: s.patientToken,
        body: { cancelReason: "No need" },
      }),
      { params: { id: b1.data.appointment.id } },
    );
    const r2 = await bookAppointment(
      makeRequest(`${BASE}/appointments`, {
        method: "POST",
        token: s.patientToken,
        body: { chamberId: s.chamberId.toString(), date: FUTURE_SAT, time: "10:20", patientProblem: "Fever" },
      }),
    );
    const b2 = await parseJson(r2);
    s.createdAppointmentIds.push(BigInt(b2.data.appointment.id));

    const res = await myAppointments(
      makeRequest(`${BASE}/appointments/my?status=CANCELLED`, { token: s.patientToken }),
    );
    const body = await parseJson(res);
    expect(res.status).toBe(200);
    expect(body.data.appointments).toHaveLength(1);
    expect(body.data.appointments[0].status).toBe("CANCELLED");
  });
});
