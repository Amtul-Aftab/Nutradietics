import { NextResponse } from "next/server";
import { IntakeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";

// Classify the best-fit professional type for the intake (Req 6). Retryable on
// AI failure; the description is preserved so the client can retry.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { intake } = await requireOwnedIntake(id);

    try {
      const { professionalType } = await geminiClient.classifyProfessionalType({
        description: intake.description,
      });

      const updated = await prisma.intake.update({
        where: { id: intake.id },
        data: { professionalType, status: IntakeStatus.CLASSIFIED },
      });

      return NextResponse.json({
        professionalType: updated.professionalType,
        status: updated.status,
      });
    } catch (aiError) {
      return aiErrorResponse(aiError);
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
