import { Type, type Schema } from "@google/genai";
import { ProfessionalType } from "@prisma/client";
import type {
  ClassifyOutput,
  GenerateQuestionsOutput,
  MatchOutput,
  SummarizeOutput,
} from "./types";

// ---------------------------------------------------------------------------
// Gemini responseSchema definitions for structured JSON output, plus runtime
// validators that re-check the parsed shape before use (Req 14.3). The schema
// constrains generation; the validator is the trust boundary.
// ---------------------------------------------------------------------------

const PROFESSIONAL_TYPE_VALUES = Object.values(ProfessionalType) as string[];

// 1. Classify --------------------------------------------------------------
export const classifySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    professionalType: {
      type: Type.STRING,
      enum: PROFESSIONAL_TYPE_VALUES,
      description: "The single best-fit professional type for the client.",
    },
  },
  required: ["professionalType"],
};

export function validateClassify(data: unknown): ClassifyOutput | null {
  if (typeof data !== "object" || data === null) return null;
  const pt = (data as Record<string, unknown>).professionalType;
  if (typeof pt !== "string" || !PROFESSIONAL_TYPE_VALUES.includes(pt)) {
    return null;
  }
  return { professionalType: pt as ProfessionalType };
}

// 2. Generate questions ----------------------------------------------------
export const questionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Between 3 and 5 targeted follow-up questions.",
    },
  },
  required: ["questions"],
};

export function validateQuestions(
  data: unknown,
): GenerateQuestionsOutput | null {
  if (typeof data !== "object" || data === null) return null;
  const q = (data as Record<string, unknown>).questions;
  if (!Array.isArray(q)) return null;
  const questions = q.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  if (questions.length < 3) return null; // too few is unusable (Req 8.5)
  // Clamp to 5 max (Req 8.5).
  return { questions: questions.slice(0, 5) };
}

// 3. Match -----------------------------------------------------------------
export const matchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    matchedProfessionalId: {
      type: Type.STRING,
      description: "The id of the chosen candidate professional.",
    },
    rationale: {
      type: Type.STRING,
      description: "Why this professional is the best fit.",
    },
  },
  required: ["matchedProfessionalId", "rationale"],
};

/**
 * Validates match output. `allowedIds` is the set of candidate ids sent to the
 * model; the returned id must be one of them (Req 9 output validation).
 */
export function validateMatch(
  data: unknown,
  allowedIds: string[],
): MatchOutput | null {
  if (typeof data !== "object" || data === null) return null;
  const rec = data as Record<string, unknown>;
  const id = rec.matchedProfessionalId;
  const rationale = rec.rationale;
  if (typeof id !== "string" || !allowedIds.includes(id)) return null;
  if (typeof rationale !== "string" || rationale.trim().length === 0) return null;
  return { matchedProfessionalId: id, rationale };
}

// 4. Summarize -------------------------------------------------------------
export const summarizeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A concise clinical-style summary for the professional.",
    },
  },
  required: ["summary"],
};

export function validateSummarize(data: unknown): SummarizeOutput | null {
  if (typeof data !== "object" || data === null) return null;
  const s = (data as Record<string, unknown>).summary;
  if (typeof s !== "string" || s.trim().length === 0) return null;
  return { summary: s };
}
