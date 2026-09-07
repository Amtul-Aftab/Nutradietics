import { NextResponse } from "next/server";
import { authErrorResponse, AuthError } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";
import { fieldSpecsForType } from "@/lib/standard-fields";

export const runtime = "nodejs";

// Returns the standard-field specs to render, based on the intake's classified
// professional type (Req 7.1, 7.2).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { intake } = await requireOwnedIntake(id);

    if (!intake.professionalType) {
      throw new AuthError(
        409,
        "Intake has not been classified yet.",
      );
    }

    return NextResponse.json({
      professionalType: intake.professionalType,
      fields: fieldSpecsForType(intake.professionalType),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
