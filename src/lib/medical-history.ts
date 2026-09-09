import { prisma } from "@/lib/prisma";

export type MedicalHistoryEntryType = "INTAKE" | "SUMMARY" | "SESSION_RECORD";

export interface MedicalHistoryQA {
  question: string;
  answer: string;
}

export interface MedicalHistoryEntry {
  id: string;
  type: MedicalHistoryEntryType;
  at: string; // ISO timestamp used for chronological ordering
  title: string;
  /** Free-text / labeled detail rows rendered by the timeline UI. */
  details: Record<string, string | null>;
  /** Structured intake fields (raw key -> value) for readable rendering + BMI. */
  standardFields?: Record<string, unknown> | null;
  /** Structured follow-up Q/A pairs for readable rendering. */
  answers?: MedicalHistoryQA[];
}

/**
 * Assembles a client's medical history as a chronological read-model from
 * their intakes, AI patient summaries, and professional-entered session
 * records (Req 13.1, 13.3, 13.4). Kept derived (no dedicated table) so it
 * always reflects the source records.
 */
export async function getMedicalHistory(
  clientProfileId: string,
): Promise<MedicalHistoryEntry[]> {
  const [intakes, summaries, sessionRecords] = await Promise.all([
    prisma.intake.findMany({
      where: { clientProfileId },
      include: { questions: { orderBy: { order: "asc" } } },
    }),
    prisma.patientSummary.findMany({
      where: { intake: { clientProfileId } },
    }),
    prisma.sessionRecord.findMany({
      where: { appointment: { clientProfileId } },
      include: {
        professional: { select: { name: true, type: true } },
        appointment: { select: { id: true } },
      },
    }),
  ]);

  const entries: MedicalHistoryEntry[] = [];

  for (const intake of intakes) {
    const answers: MedicalHistoryQA[] = intake.questions
      .filter((q) => q.answer)
      .map((q) => ({ question: q.question, answer: q.answer as string }));
    entries.push({
      id: `intake-${intake.id}`,
      type: "INTAKE",
      at: intake.createdAt.toISOString(),
      title: "Intake",
      details: {
        description: intake.description,
        professionalType: intake.professionalType,
      },
      // Pass structured fields through; the timeline renders labeled rows + BMI.
      standardFields:
        (intake.standardFields as Record<string, unknown> | null) ?? null,
      answers,
    });
  }

  for (const summary of summaries) {
    entries.push({
      id: `summary-${summary.id}`,
      type: "SUMMARY",
      at: summary.createdAt.toISOString(),
      title: "AI patient summary",
      details: { summary: summary.summary },
    });
  }

  for (const record of sessionRecords) {
    entries.push({
      id: `session-${record.id}`,
      type: "SESSION_RECORD",
      at: record.createdAt.toISOString(),
      title: `Session record — ${record.professional.name}`,
      details: {
        professionalType: record.professional.type,
        diagnosis: record.diagnosis,
        plan: record.plan,
      },
    });
  }

  // Chronological order, newest first (Req 13.4).
  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return entries;
}

/**
 * Authorizes access to a client's medical history (Req 13.5):
 * - the client themselves, OR
 * - a professional with at least one appointment for that client.
 */
export async function canAccessMedicalHistory(
  clientProfileId: string,
  viewer: { role: "CLIENT" | "PROFESSIONAL"; userId: string },
): Promise<boolean> {
  if (viewer.role === "CLIENT") {
    const profile = await prisma.clientProfile.findUnique({
      where: { id: clientProfileId },
      select: { userId: true },
    });
    return profile?.userId === viewer.userId;
  }

  // Professional: must have a booked appointment with this client.
  const professional = await prisma.professional.findUnique({
    where: { userId: viewer.userId },
    select: { id: true },
  });
  if (!professional) return false;

  const appointment = await prisma.appointment.findFirst({
    where: { clientProfileId, professionalId: professional.id },
    select: { id: true },
  });
  return Boolean(appointment);
}
