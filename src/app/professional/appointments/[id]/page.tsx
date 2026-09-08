import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { getMedicalHistory } from "@/lib/medical-history";
import { MedicalHistoryTimeline } from "@/components/MedicalHistoryTimeline";
import { SessionRecordForm } from "./SessionRecordForm";
import { AppointmentDetailsForm } from "./AppointmentDetailsForm";
import { formatRange } from "@/lib/format";

export const metadata = { title: "Appointment" };

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.PROFESSIONAL) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const professional = await prisma.professional.findUnique({
    where: { userId: session.user.id },
  });
  if (!professional) redirect("/signin");

  const { id } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      timeSlot: true,
      clientProfile: { include: { user: { select: { email: true } } } },
      sessionRecord: true,
    },
  });
  if (!appointment || appointment.professionalId !== professional.id) {
    notFound();
  }

  const clientName =
    appointment.clientProfile.name ?? appointment.clientProfile.user.email;

  // The professional has an appointment with this client, so they may view
  // the client's medical history for continuity of care (Req 13.2, 13.5).
  const history = await getMedicalHistory(appointment.clientProfileId);

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Appointment</h1>
        <Link href="/professional/schedule">Back to schedule</Link>
      </div>

      <section className="appointment__meta">
        <p>
          <strong>Client:</strong> {clientName}
        </p>
        <p>
          <strong>Time:</strong>{" "}
          {formatRange(appointment.timeSlot.startsAt, appointment.timeSlot.endsAt)}
        </p>
        <p>
          <strong>Status:</strong> {appointment.status}
        </p>
      </section>

      <section>
        <h2>Meeting &amp; payment</h2>
        <p className="appointment__hint">
          Add the video call link and mark payment (arranged off-platform).
          Both are visible to the client.
        </p>
        <AppointmentDetailsForm
          appointmentId={appointment.id}
          initialMeetingLink={appointment.meetingLink ?? ""}
          initialPaymentStatus={appointment.paymentStatus}
        />
      </section>

      <section>
        <h2>Diagnosis &amp; plan</h2>
        <p className="appointment__hint">
          Your professional assessment and recommended plan for this client.
        </p>
        <SessionRecordForm
          appointmentId={appointment.id}
          initial={
            appointment.sessionRecord
              ? {
                  diagnosis: appointment.sessionRecord.diagnosis,
                  plan: appointment.sessionRecord.plan,
                }
              : null
          }
        />
      </section>

      <section>
        <h2>Client medical history</h2>
        <p className="appointment__hint">
          Prior intakes, summaries, and session records for continuity of care.
        </p>
        <MedicalHistoryTimeline entries={history} />
      </section>
    </main>
  );
}
