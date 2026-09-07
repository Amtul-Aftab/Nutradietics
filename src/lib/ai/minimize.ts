import type { ProfessionalType } from "@prisma/client";
import type { MatchCandidate } from "./types";

// ---------------------------------------------------------------------------
// Data minimization (Req 14.5): build the minimal payloads sent to the AI
// provider. Only task-necessary fields leave our server — never emails, user
// ids, prices, or other data the model does not need for the task.
//
// Note on inert text (Req 14.4): AI-produced strings are persisted and later
// rendered as plain text (see MedicalHistoryTimeline / summary views). We never
// execute or interpret model output as instructions or markup.
// ---------------------------------------------------------------------------

interface ProfessionalWithServices {
  id: string;
  type: ProfessionalType;
  specialty: string;
  services: { description: string }[];
}

/**
 * Reduces full professional records to the minimal candidate shape the match
 * call needs: id (to select), type, specialty, and service descriptions.
 */
export function toMatchCandidates(
  professionals: ProfessionalWithServices[],
): MatchCandidate[] {
  return professionals.map((p) => ({
    professionalId: p.id,
    type: p.type,
    specialty: p.specialty,
    serviceDescriptions: p.services.map((s) => s.description),
  }));
}
