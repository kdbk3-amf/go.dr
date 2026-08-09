/**
 * Appointment slot generation (Phase 3).
 *
 * Given a chamber's weekly schedule (visiting days, start/end time,
 * slot duration), compute the concrete time slots for a calendar
 * date and mark which are still available (not already booked).
 *
 * Rules enforced here and at booking time:
 *  - chamber must be active
 *  - requested date's weekday must be in the chamber's visiting days
 *  - slot times must fall within [startTime, endTime)
 *  - slots must align to the chamber's slot grid (startTime + n*duration)
 *  - past date/time slots are never available
 */
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { timeOfDay, formatTimeOfDay } from "@/lib/query";

export interface SlotDTO {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  available: boolean;
  serialNo: number;
}

/** Lowercase 3-letter weekday abbreviation for a Date. */
export function weekdayAbbrev(d: Date): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()]!;
}

/**
 * Parse a comma-separated visiting-days string ("sat,sun,tue") into
 * a normalized set of lowercase abbreviations.
 */
export function parseVisitingDays(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].includes(s)),
  );
}

/**
 * Generate the full slot grid for a chamber on a given date, BEFORE
 * checking bookings. Returns each slot with its serial number.
 *
 * @param chamber  the chamber (must be active; caller verifies)
 * @param date     calendar date (any time-of-day; only the date part is used)
 */
export function buildSlotGrid(chamber: {
  visitingDays: string;
  startTime: Date;
  endTime: Date;
  slotDurationMinutes: number;
}, date: Date): { start: Date; end: Date; serialNo: number }[] {
  const slots: { start: Date; end: Date; serialNo: number }[] = [];

  const visiting = parseVisitingDays(chamber.visitingDays);
  const dayAbbrev = weekdayAbbrev(date);
  if (!visiting.has(dayAbbrev)) return slots;

  const duration = chamber.slotDurationMinutes;
  if (duration < 5) return slots;

  // Build slot boundaries on the requested date, using the chamber's
  // start/end hours:minutes.
  const startYmd = new Date(date);
  startYmd.setHours(0, 0, 0, 0);

  const start = new Date(startYmd);
  start.setHours(chamber.startTime.getHours(), chamber.startTime.getMinutes(), 0, 0);

  const end = new Date(startYmd);
  end.setHours(chamber.endTime.getHours(), chamber.endTime.getMinutes(), 0, 0);

  if (end <= start) return slots;

  let cursor = new Date(start);
  let serial = 1;
  while (cursor.getTime() + duration * 60_000 <= end.getTime()) {
    const slotEnd = new Date(cursor.getTime() + duration * 60_000);
    slots.push({ start: new Date(cursor), end: slotEnd, serialNo: serial });
    cursor = slotEnd;
    serial += 1;
  }
  return slots;
}

/**
 * Load a chamber, verify it is active, and return the available +
 * unavailable slots for the given date. Booked (non-cancelled) and
 * past slots are marked unavailable.
 *
 * Throws clean 404s for missing/inactive chambers and 400s for bad
 * dates. This is the backing logic for the public slots endpoint.
 */
export async function getAvailableSlots(chamberId: bigint, dateStr: string): Promise<{
  date: string;
  chamberId: string;
  slots: SlotDTO[];
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw errors.badRequest("Date must be in YYYY-MM-DD format");
  }
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) throw errors.badRequest("Invalid date");

  const chamber = await prisma.chamber.findFirst({
    where: { id: chamberId, deletedAt: null },
    select: {
      id: true,
      visitingDays: true,
      startTime: true,
      endTime: true,
      slotDurationMinutes: true,
      isActive: true,
      doctor: {
        select: { id: true, isVerified: true, isAvailable: true },
      },
    },
  });
  if (!chamber) throw errors.notFound("Chamber not found");
  if (!chamber.isActive) throw errors.notFound("Chamber not found");
  if (!chamber.doctor.isVerified || !chamber.doctor.isAvailable) {
    throw errors.notFound("Chamber not found");
  }

  const grid = buildSlotGrid(chamber, parsed);
  if (grid.length === 0) {
    return { date: dateStr, chamberId: chamberId.toString(), slots: [] };
  }

  // Booked (non-cancelled) appointments for this chamber on this date.
  const booked = await prisma.appointment.findMany({
    where: {
      chamberId,
      appointmentDate: parsed,
      status: { not: "CANCELLED" },
    },
    select: { appointmentTime: true },
  });
  const bookedMs = new Set(
    booked.map((b) => {
      const t = new Date(parsed);
      t.setHours(b.appointmentTime.getHours(), b.appointmentTime.getMinutes(), 0, 0);
      return t.getTime();
    }),
  );

  const now = new Date();
  const slots: SlotDTO[] = grid.map((g) => {
    const available = g.start.getTime() > now.getTime() && !bookedMs.has(g.start.getTime());
    return {
      startTime: formatTimeOfDay(g.start),
      endTime: formatTimeOfDay(g.end),
      available,
      serialNo: g.serialNo,
    };
  });

  return { date: dateStr, chamberId: chamberId.toString(), slots };
}

/** Convert a "YYYY-MM-DD" + "HH:mm" pair into a slot start Date. */
export function slotStartDate(dateStr: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

// Re-export timeOfDay for convenience in the booking module.
export { timeOfDay };
