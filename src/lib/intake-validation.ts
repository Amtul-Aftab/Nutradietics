import type { ValidationResult } from "./auth-validation";

// Minimum description length so the AI has enough to classify and generate
// meaningful follow-up questions (Req 5.2).
export const MIN_DESCRIPTION_LENGTH = 20;

export interface IntakeDescriptionInput {
  description: string;
}

/** Validates the plain-language intake description (Req 5.1, 5.2). */
export function validateIntakeDescription(
  raw: unknown,
): ValidationResult<IntakeDescriptionInput> {
  const errors: Record<string, string> = {};
  const body = (raw ?? {}) as Record<string, unknown>;

  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (description.length === 0) {
    errors.description = "Please describe what you need help with.";
  } else if (description.length < MIN_DESCRIPTION_LENGTH) {
    errors.description = `Please add a little more detail (at least ${MIN_DESCRIPTION_LENGTH} characters).`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { description } };
}
