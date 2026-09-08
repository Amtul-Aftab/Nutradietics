import { redirect } from "next/navigation";
import Link from "next/link";
import { AppointmentStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { formatRange } from "@/lib/format";

export const metadata = { title: "Schedule" };

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
              <div className="schedule__row">
                <span>{formatRange(a.timeSlot.startsAt, a.timeSlot.endsAt)}</span>
                <span className="schedule__client">
                  {a.clientProfile.name ?? a.clientProfile.user.email}
                </span>
              </div>
              <div className="schedule__chips">
                <span
                  className={`slots__badge slots__badge--${a.meetingLink ? "confirmed" : "booked"}`}
                >
                  {a.meetingLink ? "Meeting link added" : "No meeting link"}
                </span>
                <span
                  className={`slots__badge slots__badge--${a.paymentStatus === "PAID" ? "confirmed" : "booked"}`}
                >
                  {a.paymentStatus === "PAID" ? "Paid" : "Payment pending"}
                </span>
                <Link
                  href={`/professional/appointments/${a.id}`}
                  className="schedule__manage"
                >
                  {a.meetingLink ? "Manage" : "Add meeting link"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
