import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, AuthError } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";

// Generate and persist the AI patient summary for the intake (Req 10.1, 10.6).
// Input is description + type + standard fields + answers (no appointment param;
// the summary is produced from the intake itself, per design.md).
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

    const questions = await prisma.followUpQuestion.findMany({
      where: { intakeId: intake.id },
      orderBy: { order: "asc" },
    });
    const answers = questions
      .filter((q) => q.answer)
      .map((q) => ({ question: q.question, answer: q.answer as string }));

    try {
      const { summary } = await geminiClient.summarizePatient({
        description: intake.description,
        professionalType: intake.professionalType,
        standardFields: (intake.standardFields ?? {}) as Record<string, unknown>,
        answers,
      });

      const saved = await prisma.patientSummary.upsert({
        where: { intakeId: intake.id },
        create: { intakeId: intake.id, summary },
        update: { summary },
      });

      return NextResponse.json({ summary: saved.summary });
    } catch (aiError) {
      // Summary is best-effort; the professional can still see raw intake data
      // (Req 10.5). Surface a retryable error so the UI can offer regeneration.
      return aiErrorResponse(aiError);
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
