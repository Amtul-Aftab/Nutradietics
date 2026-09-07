import { prisma } from "@/lib/prisma";
import { geminiClient } from "@/lib/ai/gemini";

/**
 * Generates and persists the AI patient summary for an intake (Req 10.1, 10.6).
 * Gathers the intake's description, type, standard fields, and answered
 * follow-up questions, calls the AI, and upserts the PatientSummary.
 *
 * Throws on failure (AI unavailable, intake not classified) — callers decide
 * whether the failure is fatal (the standalone route) or best-effort (the
 * match flow, which must not be blocked by a summary failure — Req 10.5).
 */
export async function generatePatientSummary(intakeId: string): Promise<string> {
  const intake = await prisma.intake.findUnique({ where: { id: intakeId } });
  if (!intake) {
    throw new Error(`Intake ${intakeId} not found.`);
  }
  if (!intake.professionalType) {
    throw new Error("Intake has not been classified yet.");
  }

  const questions = await prisma.followUpQuestion.findMany({
    where: { intakeId: intake.id },
    orderBy: { order: "asc" },
  });
  const answers = questions
    .filter((q) => q.answer)
    .map((q) => ({ question: q.question, answer: q.answer as string }));

  const { summary } = await geminiClient.summarizePatient({
    description: intake.description,
    professionalType: intake.professionalType,
    standardFields: (intake.standardFields ?? {}) as Record<string, unknown>,
    answers,
  });

  await prisma.patientSummary.upsert({
    where: { intakeId: intake.id },
    create: { intakeId: intake.id, summary },
    update: { summary },
  });

  return summary;
}
