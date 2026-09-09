// Pure, client-side health-metric calculations for the standalone calculator.
// No I/O, no state — just math. Kept separate from the UI so the formulas are
// easy to read and verify.

export type Gender = "male" | "female" | "other";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very"
  | "extreme";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extreme: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  very: "Very active",
  extreme: "Extremely active",
};

export interface CalculatorInput {
  age: number;
  weightKg: number;
  heightCm: number;
  gender: Gender;
  activity: ActivityLevel;
  waistCm?: number | null;
  hipCm?: number | null;
}

export interface CategorizedValue {
  value: number;
  category: string;
}

export interface CalculatorResult {
  bmr: number; // kcal/day
  tdee: number; // kcal/day
  eer: number; // kcal/day (== tdee for display)
  bodyFatPct: CategorizedValue;
  ffmi: number;
  fmi: number;
  whr: CategorizedValue | null; // needs waist + hip
  whtr: CategorizedValue | null; // needs waist
}

/**
 * BMR via Mifflin-St Jeor. "Other" gender has no distinct clinical constant;
 * we average the male (+5) and female (-161) constants (-78) as a neutral
 * estimate and surface that caveat in the UI.
 */
export function calcBmr(input: CalculatorInput): number {
  const { weightKg, heightCm, age, gender } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const constant = gender === "male" ? 5 : gender === "female" ? -161 : -78;
  return base + constant;
}

/**
 * Body fat % estimate via the Deurenberg equation (a standard BMI-based
 * estimate that accounts for age and sex):
 *   BF% = 1.20*BMI + 0.23*age - 10.8*sex - 5.4   (sex: male=1, female=0)
 * We use sex=0.5 for "other" as a neutral midpoint. Result clamped to a sane
 * [2, 60] range.
 *
 * NOTE: the naive "370 - 21.6*weight/height_cm^2" form sometimes cited is
 * dimensionally broken (it collapses to ~370 for any realistic input), so we
 * use the well-established Deurenberg formula instead.
 */
export function calcBodyFatPct(input: CalculatorInput): number {
  const { weightKg, heightCm, age, gender } = input;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const sex = gender === "male" ? 1 : gender === "female" ? 0 : 0.5;
  const raw = 1.2 * bmi + 0.23 * age - 10.8 * sex - 5.4;
  return Math.min(60, Math.max(2, raw));
}

function bodyFatCategory(pct: number, gender: Gender): string {
  // General ranges (approximate; vary by age/gender). We use commonly cited
  // adult bands and lean toward the female bands for "other".
  const male = gender === "male";
  if (male) {
    if (pct < 6) return "Essential fat";
    if (pct < 14) return "Athletic";
    if (pct < 18) return "Fitness";
    if (pct < 25) return "Average";
    return "Above average";
  }
  if (pct < 14) return "Essential fat";
  if (pct < 21) return "Athletic";
  if (pct < 25) return "Fitness";
  if (pct < 32) return "Average";
  return "Above average";
}

function whrCategory(ratio: number, gender: Gender): string {
  // Female thresholds also used for "other".
  if (gender === "male") {
    if (ratio < 0.9) return "Good";
    if (ratio <= 0.99) return "At risk";
    return "High risk";
  }
  if (ratio < 0.8) return "Good";
  if (ratio <= 0.89) return "At risk";
  return "High risk";
}

function whtrCategory(ratio: number): string {
  if (ratio < 0.5) return "Healthy";
  if (ratio < 0.6) return "Overweight";
  return "Obese";
}

export function calculate(input: CalculatorInput): CalculatorResult {
  const bmr = calcBmr(input);
  const factor = ACTIVITY_FACTORS[input.activity];
  const tdee = bmr * factor;

  const bfPct = calcBodyFatPct(input);
  const heightM = input.heightCm / 100;
  const leanKg = input.weightKg * (1 - bfPct / 100);
  const fatKg = input.weightKg * (bfPct / 100);
  const ffmi = leanKg / (heightM * heightM);
  const fmi = fatKg / (heightM * heightM);

  const waist = input.waistCm ?? null;
  const hip = input.hipCm ?? null;

  const whr =
    waist && hip && hip > 0
      ? {
          value: waist / hip,
          category: whrCategory(waist / hip, input.gender),
        }
      : null;

  const whtr =
    waist && input.heightCm > 0
      ? {
          value: waist / input.heightCm,
          category: whtrCategory(waist / input.heightCm),
        }
      : null;

  return {
    bmr,
    tdee,
    eer: tdee,
    bodyFatPct: { value: bfPct, category: bodyFatCategory(bfPct, input.gender) },
    ffmi,
    fmi,
    whr,
    whtr,
  };
}
