import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Purely additive dashboard widget: a compact at-a-glance stat row for the
// professional. Reads existing Appointment + TimeSlot data only (no new models
// or routes). Cancelled appointments are excluded from every figure.

function formatHours(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  // Whole numbers render clean ("12h"); otherwise one decimal ("1.5h").
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

export async function ProfessionalDashboardStats({
  professionalId,
}: {
  professionalId: string;
}) {
  const appointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      status: { not: AppointmentStatus.CANCELLED },
    },
    select: {
      clientProfileId: true,
      timeSlot: { select: { startsAt: true, endsAt: true } },
    },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let thisMonth = 0;
  let totalMs = 0;
  const perClient = new Map<string, number>();

  for (const a of appointments) {
    const start = a.timeSlot.startsAt;
    const end = a.timeSlot.endsAt;

    if (start >= monthStart && start < monthEnd) thisMonth += 1;

    const durationMs = end.getTime() - start.getTime();
    if (durationMs > 0) totalMs += durationMs;

    perClient.set(
      a.clientProfileId,
      (perClient.get(a.clientProfileId) ?? 0) + 1,
    );
  }

  const total = appointments.length;
  const repeatClients = [...perClient.values()].filter((n) => n > 1).length;
  const avgMs = total > 0 ? totalMs / total : 0;

  const stats = [
    { label: "appointments", value: `${thisMonth}`, hint: "this month" },
    { label: "repeat clients", value: `${repeatClients}` },
    { label: "booked", value: formatHours(totalMs) },
    { label: "avg", value: formatHours(avgMs) },
  ];

  return (
    <section className="stats-row" aria-label="Practice overview">
      {stats.map((s) => (
        <div key={s.label} className="stats-row__stat">
          <span className="stats-row__value">{s.value}</span>
          <span className="stats-row__label">
            {s.label}
            {s.hint ? ` ${s.hint}` : ""}
          </span>
        </div>
      ))}
    </section>
  );
}
