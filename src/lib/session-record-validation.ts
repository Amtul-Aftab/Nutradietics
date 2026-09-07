import type { ValidationResult } from "./auth-validation";

export interface SessionRecordInput {
  diagnosis: string;
  plan: string;
}

/**
 * Validates a professional-entered session record. Both fields are required
 * (Req 12.1, 12.5). This content is professional-authored, never AI-generated
 * (Req 12.2).
 */
export function validateSessionRecord(
  raw: unknown,
): ValidationResult<SessionRecordInput> {
  const errors: Record<string, string> = {};
  const body = (raw ?? {}) as Record<string, unknown>;

  const diagnosis =
    typeof body.diagnosis === "string" && body.diagnosis.trim().length > 0
      ? body.diagnosis.trim()
      : "";
  if (!diagnosis) errors.diagnosis = "Diagnosis/assessment is required.";

  const plan =
    typeof body.plan === "string" && body.plan.trim().length > 0
      ? body.plan.trim()
      : "";
  if (!plan) errors.plan = "Recommended plan is required.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { diagnosis, plan } };
}
