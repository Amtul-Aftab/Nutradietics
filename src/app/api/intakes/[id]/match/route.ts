import { NextResponse } from "next/server";
import { IntakeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, AuthError } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";
import { getMatchCandidates } from "@/lib/matching";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";
import { generatePatientSummary } from "@/lib/summary";

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

      // Generate the patient summary at the match step so it is ready before
      // booking (Req 10.1, 10.6). Best-effort: a summary failure must NOT block
      // the match (Req 10.5) — the professional still sees the raw intake data,
      // and the summary can be regenerated later.
      let summaryGenerated = true;
      try {
        await generatePatientSummary(intake.id);
      } catch (summaryError) {
        summaryGenerated = false;
        console.error("Patient summary generation failed (non-blocking):", summaryError);
      }

      return NextResponse.json({
        match,
        status: IntakeStatus.MATCHED,
        summaryGenerated,
      });
    } catch (aiError) {
      return aiErrorResponse(aiError);
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
