// Shared presentational formatters (human-readable enums, consistent dates).

/**
 * Turns an enum-style value into a human-readable label:
 * "FITNESS_TRAINER" -> "Fitness Trainer", "PENDING" -> "Pending".
 */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};
const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. "Tue, Sep 10, 10:00 AM" */
export function formatDateTime(value: Date | string): string {
  const d = toDate(value);
  return `${d.toLocaleDateString(undefined, DATE_OPTS)}, ${d.toLocaleTimeString(undefined, TIME_OPTS)}`;
}

/** e.g. "Tue, Sep 10, 10:00 AM - 11:00 AM" */
export function formatRange(
  startsAt: Date | string,
  endsAt: Date | string,
): string {
  const start = toDate(startsAt);
  const end = toDate(endsAt);
  return `${start.toLocaleDateString(undefined, DATE_OPTS)}, ${start.toLocaleTimeString(undefined, TIME_OPTS)} - ${end.toLocaleTimeString(undefined, TIME_OPTS)}`;
}

/** Longer form with year, e.g. "Sep 10, 2026, 10:00 AM" (for history timestamps) */
export function formatTimestamp(value: Date | string): string {
  return toDate(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Standard intake field display (Req 7 fields) + BMI (display-time only).
// Turns the stored standardFields JSON into readable labeled rows and, when
// weight + height are present, a derived BMI row. No schema changes.
// ---------------------------------------------------------------------------

/** Human-readable labels + optional unit for known standard-field keys. */
const STANDARD_FIELD_LABELS: Record<string, { label: string; unit?: string }> =
  {
    age: { label: "Age" },
    weightKg: { label: "Weight", unit: "kg" },
    heightCm: { label: "Height", unit: "cm" },
    gender: { label: "Gender" },
    activityLevel: { label: "Activity level" },
    medicalConditions: { label: "Medical conditions" },
    medicalHistory: { label: "Medical history" },
    allergies: { label: "Allergies" },
    currentSymptoms: { label: "Current symptoms or signs" },
    recentReports: { label: "Recent test/report summaries" },
  };

// Preferred display order; keys not listed fall back to insertion order after.
const STANDARD_FIELD_ORDER = [
  "age",
  "gender",
  "weightKg",
  "heightCm",
  "activityLevel",
  "medicalConditions",
  "medicalHistory",
  "allergies",
  "currentSymptoms",
  "recentReports",
];

export interface DisplayField {
  key: string;
  label: string;
  value: string;
}

/** Title-cases a bare key like "activityLevel" -> "Activity level" as a fallback. */
function labelForKey(key: string): string {
  const known = STANDARD_FIELD_LABELS[key];
  if (known) return known.label;
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Formats a single field value: appends units, humanizes select-style tokens. */
function formatFieldValue(key: string, raw: unknown): string {
  if (raw == null || raw === "") return "";
  const meta = STANDARD_FIELD_LABELS[key];

  if (typeof raw === "number") {
    return meta?.unit ? `${raw} ${meta.unit}` : String(raw);
  }

  const str = String(raw).trim();
  if (!str) return "";
  // Select-style tokens (gender, activityLevel) are stored lowercase/underscored.
  if (key === "gender" || key === "activityLevel") {
    return humanizeEnum(str);
  }
  return meta?.unit ? `${str} ${meta.unit}` : str;
}

/**
 * Turns the raw standardFields object into ordered, labeled display rows.
 * Accepts the stored value which may be an object or a JSON string; empty /
 * unparseable input yields an empty list.
 */
export function formatStandardFields(raw: unknown): DisplayField[] {
  const obj = coerceToObject(raw);
  if (!obj) return [];

  const keys = Object.keys(obj);
  keys.sort((a, b) => {
    const ia = STANDARD_FIELD_ORDER.indexOf(a);
    const ib = STANDARD_FIELD_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const rows: DisplayField[] = [];
  for (const key of keys) {
    const value = formatFieldValue(key, obj[key]);
    if (value) rows.push({ key, label: labelForKey(key), value });
  }
  return rows;
}

export interface BmiResult {
  value: number; // rounded to 1 decimal
  category: "Underweight" | "Normal range" | "Overweight" | "Obese";
  /** e.g. "23.4 (Normal range)" */
  display: string;
}

/**
 * Computes BMI from weightKg + heightCm in a standardFields object, display-time
 * only. Returns null when either value is missing or non-positive. Formula:
 * weight / (height/100)^2. Categories use standard WHO thresholds.
 */
export function computeBmi(raw: unknown): BmiResult | null {
  const obj = coerceToObject(raw);
  if (!obj) return null;

  const weight = Number(obj.weightKg);
  const heightCm = Number(obj.heightCm);
  if (!Number.isFinite(weight) || !Number.isFinite(heightCm)) return null;
  if (weight <= 0 || heightCm <= 0) return null;

  const heightM = heightCm / 100;
  const bmi = weight / (heightM * heightM);
  if (!Number.isFinite(bmi)) return null;

  const value = Math.round(bmi * 10) / 10;
  let category: BmiResult["category"];
  if (value < 18.5) category = "Underweight";
  else if (value < 25) category = "Normal range";
  else if (value < 30) category = "Overweight";
  else category = "Obese";

  return { value, category, display: `${value.toFixed(1)} (${category})` };
}

/** Accepts an object or JSON string; returns a plain record or null. */
function coerceToObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
  return obj as Record<string, unknown>;
}
