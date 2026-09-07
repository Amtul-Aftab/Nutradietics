import { redirect } from "next/navigation";
import Link from "next/link";
import { AppointmentStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";

function formatRange(startsAt: Date, endsAt: Date): string {
  const date = startsAt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  return `${date}, ${startsAt.toLocaleTimeString(undefined, opts)} – ${endsAt.toLocaleTimeString(undefined, opts)}`;
}

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.PROFESSIONAL) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const professional = await prisma.professional.findUnique({
    where: { userId: session.user.id },
  });
  if (!professional) redirect("/signin");

  const appointments = await prisma.appointment.findMany({
    where: {
      professionalId: professional.id,
      status: { not: AppointmentStatus.CANCELLED },
    },
    include: {
      timeSlot: true,
      clientProfile: { include: { user: { select: { email: true } } } },
    },
    orderBy: { timeSlot: { startsAt: "asc" } },
  });

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Your schedule</h1>
        <Link href="/professional">Back to dashboard</Link>
      </div>
      {appointments.length === 0 ? (
        <p className="slots__empty">No appointments booked yet.</p>
      ) : (
        <ul className="schedule">
          {appointments.map((a) => (
            <li key={a.id} className="schedule__item">
              <Link
                href={`/professional/appointments/${a.id}`}
                className="schedule__link"
              >
                <span>{formatRange(a.timeSlot.startsAt, a.timeSlot.endsAt)}</span>
                <span className="schedule__client">
                  {a.clientProfile.name ?? a.clientProfile.user.email}
                </span>
              </Link>
              <span
                className={`slots__badge slots__badge--${a.status.toLowerCase()}`}
              >
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
