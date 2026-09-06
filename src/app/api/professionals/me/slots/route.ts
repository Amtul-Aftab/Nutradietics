import { NextResponse } from "next/server";
import { SlotStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";
import { createSlot, SlotConflictError, SlotValidationError } from "@/lib/slots";

export const runtime = "nodejs";

// List the current professional's non-removed slots.
export async function GET() {
  try {
    const { professional } = await requireProfessional();
    const slots = await prisma.timeSlot.findMany({
      where: {
        professionalId: professional.id,
        status: { not: SlotStatus.REMOVED },
      },
      orderBy: { startsAt: "asc" },
    });
    return NextResponse.json({ slots });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// Create an available slot (Req 4.1); rejects bad ranges (400) and overlaps (409).
export async function POST(request: Request) {
  try {
    const { professional } = await requireProfessional();

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
    const startsAt = new Date(String(body.startsAt));
    const endsAt = new Date(String(body.endsAt));

    const slot = await createSlot({
      professionalId: professional.id,
      startsAt,
      endsAt,
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    if (error instanceof SlotValidationError) {
      return NextResponse.json(
        { error: "Validation failed.", fieldErrors: error.fieldErrors },
        { status: 400 },
      );
    }
    if (error instanceof SlotConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
