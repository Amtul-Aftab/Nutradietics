import { NextResponse } from "next/server";
import { IntakeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, AuthError } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";

// Generate type-adapted follow-up questions (Req 8) and persist them; advances
// to QUESTIONS_READY. Retryable on AI failure without losing prior input.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { intake } = await requireOwnedIntake(id);

    if (!intake.professionalType || !intake.standardFields) {
      throw new AuthError(409, "Standard fields have not been collected yet.");
    }

    try {
      const { questions } = await geminiClient.generateFollowUpQuestions({
        description: intake.description,
        professionalType: intake.professionalType,
        standardFields: intake.standardFields as Record<string, unknown>,
      });

      // Replace any previously generated questions for a clean retry.
      const saved = await prisma.$transaction(async (tx) => {
        await tx.followUpQuestion.deleteMany({ where: { intakeId: intake.id } });
        await tx.followUpQuestion.createMany({
          data: questions.map((question, i) => ({
            intakeId: intake.id,
            order: i,
            question,
          })),
        });
        await tx.intake.update({
          where: { id: intake.id },
          data: { status: IntakeStatus.QUESTIONS_READY },
        });
        return tx.followUpQuestion.findMany({
          where: { intakeId: intake.id },
          orderBy: { order: "asc" },
        });
      });

      return NextResponse.json({ questions: saved, status: IntakeStatus.QUESTIONS_READY });
    } catch (aiError) {
      return aiErrorResponse(aiError);
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
