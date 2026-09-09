import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireClient } from "@/lib/client";
import {
  bookSlot,
  SlotNotFoundError,
  SlotUnavailableError,
} from "@/lib/booking";
import { sendBookingConfirmationEmails } from "@/lib/booking-emails";

export const runtime = "nodejs";

/**
 * Books an appointment for the signed-in client (Req 11.2, 11.4).
 *
 * Two body shapes are supported:
 *  - Intake-driven: { intakeId, timeSlotId } — the professional is derived from
 *    the intake's match; on success the intake is set to BOOKED (Req 11.2).
 *  - Direct: { professionalId, timeSlotId } — book a specific professional's slot.
 */
export async function POST(request: Request) {
  try {
    const { clientProfile } = await requireClient();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const body = (raw ?? {}) as Record<string, unknown>;
    const intakeId = typeof body.intakeId === "string" ? body.intakeId : "";
    const professionalId =
      typeof body.professionalId === "string" ? body.professionalId : "";
    const timeSlotId =
      typeof body.timeSlotId === "string" ? body.timeSlotId : "";

    if (!timeSlotId || (!intakeId && !professionalId)) {
      return NextResponse.json(
        { error: "timeSlotId and one of intakeId or professionalId are required." },
        { status: 400 },
      );
    }

    // Resolve the expected professional id.
    let expectedProfessionalId = professionalId;

    if (intakeId) {
      // Verify the intake belongs to this client and has a match.
      const intake = await prisma.intake.findUnique({
        where: { id: intakeId },
        include: { match: true },
      });
      if (!intake || intake.clientProfileId !== clientProfile.id) {
        return NextResponse.json(
          { error: "Intake not found." },
          { status: 404 },
        );
      }
      if (!intake.match) {
        return NextResponse.json(
          { error: "This intake has not been matched yet." },
          { status: 409 },
        );
      }
      expectedProfessionalId = intake.match.matchedProfessionalId;
    }

    // Confirm the slot exists and belongs to the expected professional.
    const slot = await prisma.timeSlot.findUnique({ where: { id: timeSlotId } });
    if (!slot || slot.professionalId !== expectedProfessionalId) {
      return NextResponse.json(
        { error: "Time slot not found for that professional." },
        { status: 404 },
      );
    }

    const appointment = await bookSlot({
      clientProfileId: clientProfile.id,
      timeSlotId,
      intakeId: intakeId || null,
    });

    // Best-effort confirmation emails to client + professional. This never
    // throws (see sendBookingConfirmationEmails) so it cannot block or fail
    // the booking response.
    await sendBookingConfirmationEmails(appointment.id);

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof SlotNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SlotUnavailableError) {
      // Prompt the client to pick another slot (Req 11.3).
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
