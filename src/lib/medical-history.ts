import { type ProfessionalType } from "@prisma/client";
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
 * When a professional is the viewer, their identity is passed here so every
 * query can be scoped to only their relevant records — no cross-professional
 * data leakage (Req 13.5). When absent the client is the viewer and receives
 * their full history across all professionals (Req 13.6).
 */
export interface ProfessionalContext {
  /** Professional.id (the row PK, not User.id). */
  professionalId: string;
  /** Filters intakes and summaries to this professional's discipline. */
  professionalType: ProfessionalType;
}

/**
 * Assembles a client's medical history as a chronological read-model from
 * their intakes, AI patient summaries, and professional-entered session
 * records (Req 13.1, 13.3, 13.4). Kept derived (no dedicated table) so it
 * always reflects the source records.
 *
 * When `professionalContext` is supplied the result is scoped:
 *   - Intakes: only those matching the professional's type
 *     (Intake.professionalType, e.g. NUTRITIONIST).
 *   - AI summaries: only those attached to the scoped intakes (via the same
 *     professionalType filter on the parent intake).
 *   - Session records: only records authored by this professional
 *     (SessionRecord → Appointment.professionalId).
 *
 * This ensures a nutritionist sees only nutritionist intakes/summaries/records
 * and a fitness trainer sees only fitness trainer data — even for a client who
 * has appointments with both. No schema migration is required because
 * Intake.professionalType and Appointment.professionalId already exist.
 */
export async function getMedicalHistory(
  clientProfileId: string,
  professionalContext?: ProfessionalContext,
): Promise<MedicalHistoryEntry[]> {
  const [intakes, summaries, sessionRecords] = await Promise.all([
    prisma.intake.findMany({
      where: {
        clientProfileId,
        // Scope to the requesting professional's discipline when viewing as a
        // professional. Intakes without a professionalType (status DESCRIBED,
        // not yet classified) are omitted from professional views — they have
        // no type association and cannot be attributed to a discipline yet.
        ...(professionalContext
          ? { professionalType: professionalContext.professionalType }
          : {}),
      },
      include: { questions: { orderBy: { order: "asc" } } },
    }),
    prisma.patientSummary.findMany({
      where: {
        intake: {
          clientProfileId,
          // Summaries are scoped via their parent intake's professionalType.
          ...(professionalContext
            ? { professionalType: professionalContext.professionalType }
            : {}),
        },
      },
    }),
    prisma.sessionRecord.findMany({
      where: {
        appointment: {
          clientProfileId,
          // Session records are scoped to the exact professional who authored
          // them — not just the same type, but the same individual — so two
          // nutritionists cannot see each other's session notes.
          ...(professionalContext
            ? { professionalId: professionalContext.professionalId }
            : {}),
        },
      },
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
