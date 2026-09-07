import { NextResponse } from "next/server";
import { authErrorResponse, AuthError } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";
import { aiErrorResponse } from "@/lib/ai/errors";
import { generatePatientSummary } from "@/lib/summary";

export const runtime = "nodejs";

// Generate and persist the AI patient summary for the intake (Req 10.1, 10.6).
// The summary is normally produced automatically at the match step; this route
// allows explicit (re)generation. Input is the intake data (description + type
// + standard fields + answers), not an appointment.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { intake } = await requireOwnedIntake(id);

    if (!intake.professionalType) {
      throw new AuthError(409, "Intake has not been classified yet.");
    }

    try {
      const summary = await generatePatientSummary(intake.id);
      return NextResponse.json({ summary });
    } catch (aiError) {
      // Summary is best-effort; the professional can still see raw intake data
      // (Req 10.5). Surface a retryable error so the UI can offer regeneration.
      return aiErrorResponse(aiError);
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
