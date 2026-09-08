import { redirect } from "next/navigation";
import Link from "next/link";
import { AppointmentStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";

export const dynamic = "force-dynamic";

function formatRange(startsAt: Date, endsAt: Date): string {
  const date = startsAt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${date}, ${startsAt.toLocaleTimeString(undefined, opts)} - ${endsAt.toLocaleTimeString(undefined, opts)}`;
}

export default async function ClientAppointmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.CLIENT) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!clientProfile) redirect("/signin");

  const appointments = await prisma.appointment.findMany({
    where: {
      clientProfileId: clientProfile.id,
      status: { not: AppointmentStatus.CANCELLED },
    },
    include: { timeSlot: true, professional: { select: { name: true, type: true } } },
    orderBy: { timeSlot: { startsAt: "asc" } },
  });

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Your appointments</h1>
        <Link href="/client">Back to dashboard</Link>
      </div>

      {appointments.length === 0 ? (
        <p className="slots__empty">You have no appointments yet.</p>
      ) : (
        <ul className="schedule">
          {appointments.map((a) => (
            <li key={a.id} className="appointment__card">
              <div className="appointment__card-head">
                <strong>{a.professional.name}</strong>
                <span
                  className={`slots__badge slots__badge--${a.paymentStatus === "PAID" ? "confirmed" : "booked"}`}
                >
                  {a.paymentStatus === "PAID" ? "Paid" : "Payment pending"}
                </span>
              </div>
              <p className="appointment__hint">
                {formatRange(a.timeSlot.startsAt, a.timeSlot.endsAt)}
              </p>
              <p>
                <strong>Video call:</strong>{" "}
                {a.meetingLink ? (
                  <a href={a.meetingLink} target="_blank" rel="noopener noreferrer">
                    Join link
                  </a>
                ) : (
                  <span className="appointment__hint">
                    Not provided yet — your professional will add it.
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
