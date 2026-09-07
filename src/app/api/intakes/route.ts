import { NextResponse } from "next/server";
import { IntakeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireClient } from "@/lib/client";
import { validateIntakeDescription } from "@/lib/intake-validation";

export const runtime = "nodejs";

/**
 * Creates an intake from a plain-language description for the signed-in client
 * (Req 5.1, 5.3). Rejects empty/too-short descriptions (Req 5.2). New intakes
 * start at status DESCRIBED.
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

    const result = validateIntakeDescription(raw);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Validation failed.", fieldErrors: result.errors },
        { status: 400 },
      );
    }

    const intake = await prisma.intake.create({
      data: {
        clientProfileId: clientProfile.id,
        description: result.value.description,
        status: IntakeStatus.DESCRIBED,
      },
    });

    return NextResponse.json({ intake }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
