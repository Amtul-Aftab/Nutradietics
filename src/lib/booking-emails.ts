import { prisma } from "@/lib/prisma";
import { appBaseUrl, sendEmail } from "@/lib/email";
import { formatRange, humanizeEnum } from "@/lib/format";

// ---------------------------------------------------------------------------
// Booking confirmation emails (additive). Sends one email to the client and
// one to the professional after a booking succeeds. Best-effort: this function
// never throws and never blocks the booking response — any failure (missing
// RESEND_API_KEY, network error, missing data) is logged and swallowed.
//
// Note on "service": appointments are not linked to a specific Service row in
// the data model, so the professional's specialty (falling back to a humanized
// professional type) is used as the service descriptor. No model changes.
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendBookingConfirmationEmails(
  appointmentId: string,
): Promise<void> {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        timeSlot: { select: { startsAt: true, endsAt: true } },
        clientProfile: {
          select: { name: true, user: { select: { email: true } } },
        },
        professional: {
          select: {
            name: true,
            type: true,
            specialty: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!appointment) {
      console.error(
        `[booking-emails] Appointment ${appointmentId} not found; skipping.`,
      );
      return;
    }

    const { timeSlot, clientProfile, professional } = appointment;
    const when = formatRange(timeSlot.startsAt, timeSlot.endsAt);
    const clientName = clientProfile.name?.trim() || "there";
    const clientEmail = clientProfile.user.email;
    const professionalName = professional.name?.trim() || "your professional";
    const professionalEmail = professional.user.email;
    const typeLabel = humanizeEnum(professional.type);
    const serviceName = professional.specialty?.trim() || typeLabel;

    const base = appBaseUrl();
    const clientLink = `${base}/client/appointments`;
    const professionalLink = `${base}/professional/appointments/${appointment.id}`;
    const meetingLink = appointment.meetingLink?.trim() || null;

    // Fire both sends independently; one failing must not affect the other.
    const results = await Promise.allSettled([
      sendEmail({
        to: clientEmail,
        subject: `Appointment Confirmed - ${professionalName}`,
        html: [
          `<p>Hi ${escapeHtml(clientName)},</p>`,
          `<p>Your appointment is confirmed.</p>`,
          `<ul>`,
          `<li><strong>When:</strong> ${escapeHtml(when)}</li>`,
          `<li><strong>Professional:</strong> ${escapeHtml(professionalName)} (${escapeHtml(typeLabel)})</li>`,
          `<li><strong>Service:</strong> ${escapeHtml(serviceName)}</li>`,
          meetingLink
            ? `<li><strong>Meeting link:</strong> <a href="${escapeHtml(meetingLink)}">${escapeHtml(meetingLink)}</a></li>`
            : `<li><strong>Meeting link:</strong> to be added by your professional</li>`,
          `</ul>`,
          `<p><a href="${clientLink}">View your appointment</a></p>`,
        ].join(""),
      }),
      sendEmail({
        to: professionalEmail,
        subject: `New Appointment - ${clientName}`,
        html: [
          `<p>Hi ${escapeHtml(professionalName)},</p>`,
          `<p>You have a new appointment.</p>`,
          `<ul>`,
          `<li><strong>When:</strong> ${escapeHtml(when)}</li>`,
          `<li><strong>Client:</strong> ${escapeHtml(clientName)}</li>`,
          `<li><strong>Service:</strong> ${escapeHtml(serviceName)}</li>`,
          `</ul>`,
          `<p><a href="${professionalLink}">View patient summary</a></p>`,
        ].join(""),
      }),
    ]);

    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `[booking-emails] ${i === 0 ? "client" : "professional"} email threw:`,
          r.reason,
        );
      }
    });
  } catch (error) {
    // Absolutely never propagate — booking has already succeeded.
    console.error("[booking-emails] Unexpected failure:", error);
  }
}
