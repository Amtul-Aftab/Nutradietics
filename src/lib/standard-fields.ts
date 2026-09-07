import { ProfessionalType } from "@prisma/client";
import type { ValidationResult } from "./auth-validation";

// ---------------------------------------------------------------------------
// Type-specific standard intake fields (Req 7).
// Shared (both types): age, weightKg, heightCm, gender, activityLevel,
//   medicalConditions, medicalHistory, allergies.
// Nutritionist-only additions: currentSymptoms, recentReports (free text).
// Fitness trainer must NOT include the nutritionist-only fields.
// ---------------------------------------------------------------------------

export type FieldKind = "number" | "text" | "textarea" | "select";

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options?: string[];
  hint?: string;
}

const GENDER_OPTIONS = ["male", "female", "other", "unspecified"];
const ACTIVITY_OPTIONS = ["sedentary", "light", "moderate", "active", "very_active"];

const SHARED_FIELDS: FieldSpec[] = [
  { key: "age", label: "Age", kind: "number", required: true },
  { key: "weightKg", label: "Weight (kg)", kind: "number", required: true },
  { key: "heightCm", label: "Height (cm)", kind: "number", required: true },
  { key: "gender", label: "Gender", kind: "select", required: true, options: GENDER_OPTIONS },
  {
    key: "activityLevel",
    label: "Activity level",
    kind: "select",
    required: true,
    options: ACTIVITY_OPTIONS,
  },
  { key: "medicalConditions", label: "Medical conditions", kind: "textarea", required: false },
  { key: "medicalHistory", label: "Medical history", kind: "textarea", required: false },
  { key: "allergies", label: "Allergies", kind: "textarea", required: false },
];

const NUTRITIONIST_ONLY_FIELDS: FieldSpec[] = [
  {
    key: "currentSymptoms",
    label: "Current symptoms or signs",
    kind: "textarea",
    required: false,
  },
  {
    key: "recentReports",
    label: "Recent test/report summaries (past 6 months)",
    kind: "textarea",
    required: false,
    hint: "Brief text summary only — no file uploads.",
  },
];

/** Returns the field specs to render for a given professional type (Req 7.1, 7.2). */
export function fieldSpecsForType(type: ProfessionalType): FieldSpec[] {
  return type === ProfessionalType.NUTRITIONIST
    ? [...SHARED_FIELDS, ...NUTRITIONIST_ONLY_FIELDS]
    : [...SHARED_FIELDS];
}

const NUTRITIONIST_ONLY_KEYS = NUTRITIONIST_ONLY_FIELDS.map((f) => f.key);

/**
 * Validates and normalizes submitted standard fields against the type-specific
 * spec (Req 7.4). Numeric fields must be positive numbers; nutritionist-only
 * fields are rejected for fitness trainers (Req 7.2). recentReports is text
 * only — never a file (Req 7.3), enforced by accepting strings only.
 */
export function validateStandardFields(
  type: ProfessionalType,
  raw: unknown,
): ValidationResult<Record<string, unknown>> {
  const errors: Record<string, string> = {};
  const body = (raw ?? {}) as Record<string, unknown>;
  const specs = fieldSpecsForType(type);
  const allowedKeys = new Set(specs.map((s) => s.key));
  const value: Record<string, unknown> = {};

  // Reject fields not allowed for this type (e.g. nutritionist-only for trainer).
  if (type === ProfessionalType.FITNESS_TRAINER) {
    for (const key of NUTRITIONIST_ONLY_KEYS) {
      if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
        errors[key] = "This field does not apply to fitness trainer intakes.";
      }
    }
  }

  for (const spec of specs) {
    const rawVal = body[spec.key];

    if (spec.kind === "number") {
      const n = typeof rawVal === "number" ? rawVal : Number(rawVal);
      if (rawVal === undefined || rawVal === null || rawVal === "" || Number.isNaN(n)) {
        if (spec.required) errors[spec.key] = `${spec.label} is required.`;
        continue;
      }
      if (n <= 0) {
        errors[spec.key] = `${spec.label} must be a positive number.`;
        continue;
      }
      value[spec.key] = n;
      continue;
    }

    if (spec.kind === "select") {
      const s = typeof rawVal === "string" ? rawVal : "";
      if (!s) {
        if (spec.required) errors[spec.key] = `${spec.label} is required.`;
        continue;
      }
      if (spec.options && !spec.options.includes(s)) {
        errors[spec.key] = `Select a valid ${spec.label.toLowerCase()}.`;
        continue;
      }
      value[spec.key] = s;
      continue;
    }

    // text / textarea (free text only)
    const s = typeof rawVal === "string" ? rawVal.trim() : "";
    if (!s) {
      if (spec.required) errors[spec.key] = `${spec.label} is required.`;
      continue;
    }
    value[spec.key] = s;
  }

  // Guard against stray keys outside the allowed set.
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key) && !errors[key]) {
      // Silently ignore unknown keys rather than persisting them.
      continue;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}
