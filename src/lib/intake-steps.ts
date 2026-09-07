import { IntakeStatus } from "@prisma/client";

// The ordered steps of the client intake journey (design.md state machine).
// Phase 7 implements the DESCRIBE step; later phases fill in the rest.
export const INTAKE_STEPS = [
  "DESCRIBE",
  "CLASSIFY",
  "FIELDS",
  "QUESTIONS",
  "MATCH",
  "BOOK",
] as const;

export type IntakeStep = (typeof INTAKE_STEPS)[number];

/** Maps an intake's persisted status to the wizard step the user should see. */
export function stepForStatus(status: IntakeStatus | null): IntakeStep {
  switch (status) {
    case null:
      return "DESCRIBE"; // no intake yet
    case IntakeStatus.DESCRIBED:
      return "CLASSIFY";
    case IntakeStatus.CLASSIFIED:
      return "FIELDS";
    case IntakeStatus.FIELDS_COLLECTED:
      return "QUESTIONS";
    case IntakeStatus.QUESTIONS_READY:
      return "QUESTIONS";
    case IntakeStatus.ANSWERED:
      return "MATCH";
    case IntakeStatus.MATCHED:
      return "BOOK";
    case IntakeStatus.BOOKED:
      return "BOOK";
    default:
      return "DESCRIBE";
  }
}

export const STEP_LABELS: Record<IntakeStep, string> = {
  DESCRIBE: "Describe your needs",
  CLASSIFY: "Finding the right type of professional",
  FIELDS: "A few health details",
  QUESTIONS: "Follow-up questions",
  MATCH: "Your match",
  BOOK: "Book an appointment",
};
