import { NextResponse } from "next/server";
import { IntakeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, AuthError } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";
import { getMatchCandidates } from "@/lib/matching";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";

// Return the existing match (if any) for this intake.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { intake } = await requireOwnedIntake(id);
    const match = await prisma.match.findUnique({ where: { intakeId: intake.id } });
    return NextResponse.json({ match });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// Match the client to a best-fit professional of the identified type (Req 9).
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

    // Gather intake context (standard fields + answers).
    const questions = await prisma.followUpQuestion.findMany({
      where: { intakeId: intake.id },
      orderBy: { order: "asc" },
    });
    const answers = questions
      .filter((q) => q.answer)
      .map((q) => ({ question: q.question, answer: q.answer as string }));

    // Candidate pre-filter (Req 9.2, 9.3); no candidates -> no-match (Req 9.5).
    const candidates = await getMatchCandidates(intake.professionalType);
    if (candidates.length === 0) {
      return NextResponse.json({ match: null, reason: "no_match_available" });
    }

    try {
      const { matchedProfessionalId, rationale } =
        await geminiClient.matchProfessional({
          description: intake.description,
          standardFields: (intake.standardFields ?? {}) as Record<string, unknown>,
          answers,
          candidates,
        });

      const match = await prisma.$transaction(async (tx) => {
        const created = await tx.match.upsert({
          where: { intakeId: intake.id },
          create: { intakeId: intake.id, matchedProfessionalId, rationale },
          update: { matchedProfessionalId, rationale },
        });
        await tx.intake.update({
          where: { id: intake.id },
          data: { status: IntakeStatus.MATCHED },
        });
        return created;
      });

      return NextResponse.json({ match, status: IntakeStatus.MATCHED });
    } catch (aiError) {
      return aiErrorResponse(aiError);
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
