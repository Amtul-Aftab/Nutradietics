import { NextResponse } from "next/server";
import { IntakeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, AuthError } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";
import { validateStandardFields } from "@/lib/standard-fields";

export const runtime = "nodejs";

// Persist the client's type-specific standard fields (Req 7.4, 7.5); advances
// the intake to FIELDS_COLLECTED.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { intake } = await requireOwnedIntake(id);

    if (!intake.professionalType) {
      throw new AuthError(409, "Intake has not been classified yet.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const result = validateStandardFields(intake.professionalType, raw);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Validation failed.", fieldErrors: result.errors },
        { status: 400 },
      );
    }

    const updated = await prisma.intake.update({
      where: { id: intake.id },
      data: {
        standardFields: result.value as Prisma.InputJsonValue,
        status: IntakeStatus.FIELDS_COLLECTED,
      },
    });

    return NextResponse.json({
      standardFields: updated.standardFields,
      status: updated.status,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
