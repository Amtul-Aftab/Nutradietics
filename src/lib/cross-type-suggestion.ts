import { ProfessionalType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Cross-type suggestion (UI-only, Req 10.7).
// A lightweight, deterministic heuristic: if the client's description hints at
// goals that commonly benefit from BOTH nutrition and fitness support (e.g.
// weight loss, energy, general fitness/wellness), we suggest also getting
// matched with the OTHER professional type. This does not change the AI
// classification (still exactly one type) or the data model — clients can run
// multiple independent intakes.
// ---------------------------------------------------------------------------

// Goals that typically span both nutrition and fitness.
const DUAL_BENEFIT_KEYWORDS = [
  "weight",
  "lose",
  "losing",
  "fat",
  "energy",
  "fitness",
  "fit",
  "healthy",
  "healthier",
  "wellness",
  "shape",
  "tone",
  "strength",
  "stronger",
  "muscle",
  "stamina",
  "endurance",
  "lifestyle",
];

export interface CrossTypeSuggestion {
  otherType: ProfessionalType;
  otherTypeLabel: string;
  message: string;
}

function labelFor(type: ProfessionalType): string {
  return type === ProfessionalType.NUTRITIONIST ? "nutritionist" : "fitness trainer";
}

/**
 * Returns a suggestion to also get matched with the other professional type
 * when the description suggests a dual-benefit goal; otherwise null.
 */
export function getCrossTypeSuggestion(
  description: string,
  matchedType: ProfessionalType,
): CrossTypeSuggestion | null {
  const text = description.toLowerCase();
  const hasDualBenefitGoal = DUAL_BENEFIT_KEYWORDS.some((kw) =>
    // Word-ish boundary check to avoid matching inside unrelated words.
    new RegExp(`\\b${kw}`, "i").test(text),
  );
  if (!hasDualBenefitGoal) return null;

  const otherType =
    matchedType === ProfessionalType.NUTRITIONIST
      ? ProfessionalType.FITNESS_TRAINER
      : ProfessionalType.NUTRITIONIST;
  const otherTypeLabel = labelFor(otherType);

  return {
    otherType,
    otherTypeLabel,
    message: `This goal often benefits from both nutrition and fitness support — want to also get matched with a ${otherTypeLabel}?`,
  };
}
