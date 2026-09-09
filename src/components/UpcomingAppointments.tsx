import Link from "next/link";
import { AppointmentStatus, type ProfessionalType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime, humanizeEnum } from "@/lib/format";

// Purely additive dashboard widget: the professional's next few upcoming
// appointments. Reads existing Appointment + TimeSlot + ClientProfile data
// only. "View all" points at the existing schedule page.

export async function UpcomingAppointments({
  professionalId,
  professionalType,
}: {
  professionalId: string;
  professionalType: ProfessionalType;
}) {
  const now = new Date();

  const appointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      status: { not: AppointmentStatus.CANCELLED },
      timeSlot: { startsAt: { gte: now } }, // future only
    },
    include: {
      timeSlot: { select: { startsAt: true } },
      clientProfile: {
        select: { name: true, user: { select: { email: true } } },
      },
    },
    orderBy: { timeSlot: { startsAt: "asc" } },
    take: 5,
  });

  return (
    <section className="upcoming">
      <div className="upcoming__head">
        <h2 className="upcoming__title">Upcoming appointments</h2>
        <Link href="/professional/schedule" className="upcoming__all">
          View all appointments
        </Link>
      </div>

      {appointments.length === 0 ? (
        <p className="slots__empty">No appointments scheduled</p>
      ) : (
        <ul className="upcoming__list">
          {appointments.map((a) => (
            <li key={a.id} className="upcoming__item">
              <div className="upcoming__who">
                <strong>
                  {a.clientProfile.name?.trim() || a.clientProfile.user.email}
                </strong>
                <span className="upcoming__type">
                  {humanizeEnum(professionalType)}
                </span>
              </div>
              <time className="upcoming__when">
                {formatDateTime(a.timeSlot.startsAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
