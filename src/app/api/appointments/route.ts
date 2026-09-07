import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireClient } from "@/lib/client";
import {
  bookSlot,
  SlotNotFoundError,
  SlotUnavailableError,
} from "@/lib/booking";

export const runtime = "nodejs";

/**
 * Books an appointment for the signed-in client (Req 11.2, 11.4).
 * Body: { professionalId, timeSlotId }. The intakeId linkage is added in
 * Phase 10; direct bookings leave it null.
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
    const professionalId =
      typeof body.professionalId === "string" ? body.professionalId : "";
    const timeSlotId =
      typeof body.timeSlotId === "string" ? body.timeSlotId : "";

    if (!professionalId || !timeSlotId) {
      return NextResponse.json(
        { error: "professionalId and timeSlotId are required." },
        { status: 400 },
      );
    }

    // Confirm the slot exists and belongs to the named professional before
    // attempting to book (avoids mismatched professional/slot pairings).
    const slot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotId },
    });
    if (!slot || slot.professionalId !== professionalId) {
      return NextResponse.json(
        { error: "Time slot not found for that professional." },
        { status: 404 },
      );
    }

    const appointment = await bookSlot({
      clientProfileId: clientProfile.id,
      timeSlotId,
    });

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
