import { prisma } from "@/lib/prisma";

async function getFoundationStatus() {
  try {
    const [userCount, specialtyCount] = await Promise.all([
      prisma.user.count(),
      prisma.specialty.count(),
    ]);
    return { ok: true, userCount, specialtyCount };
  } catch {
    return { ok: false, userCount: 0, specialtyCount: 0 };
  }
}

export default async function HomePage() {
  const status = await getFoundationStatus();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold text-brand">Go Dr</h1>
      <p className="text-lg text-slate-600">
        Healthcare platform for Bangladesh — Phase 0 Foundation
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Foundation Status
        </h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>Next.js + TypeScript + Tailwind — ready</li>
          <li>PostgreSQL + Prisma schema — ready</li>
          <li>
            Database connection:{" "}
            <span
              className={
                status.ok ? "text-brand-accent" : "text-red-600"
              }
            >
              {status.ok ? "connected" : "not connected"}
            </span>
          </li>
          <li>Users in DB: {status.userCount}</li>
          <li>Specialties in DB: {status.specialtyCount}</li>
        </ul>
      </div>

      <p className="text-xs text-slate-400">
        Auth, appointments, payments and frontend pages arrive in later phases.
      </p>
    </main>
  );
}
