import type { ProfessionalType } from "@prisma/client";

// ---------------------------------------------------------------------------
// AI operation input/output types (design.md "AI Integration" contracts).
// Provider-specific implementation lives in gemini.ts; these types are the
// stable surface the rest of the app depends on.
// ---------------------------------------------------------------------------

/** 1. Classify professional type (Req 6). */
export interface ClassifyInput {
  description: string;
}
export interface ClassifyOutput {
  professionalType: ProfessionalType;
}

/** 2. Generate follow-up questions (Req 8). */
export interface GenerateQuestionsInput {
  description: string;
  professionalType: ProfessionalType;
  standardFields: Record<string, unknown>;
}
export interface GenerateQuestionsOutput {
  questions: string[];
}

/** 3. Match professional (Req 9). */
export interface MatchCandidate {
  professionalId: string;
  type: ProfessionalType;
  specialty: string;
  serviceDescriptions: string[];
}
export interface MatchInput {
  description: string;
  standardFields: Record<string, unknown>;
  answers: { question: string; answer: string }[];
  candidates: MatchCandidate[];
}
export interface MatchOutput {
  matchedProfessionalId: string;
  rationale: string;
}

/** 4. Summarize patient (Req 10). */
export interface SummarizeInput {
  description: string;
  professionalType: ProfessionalType;
  standardFields: Record<string, unknown>;
  answers: { question: string; answer: string }[];
}
export interface SummarizeOutput {
  summary: string;
}

/**
 * The four AI operations the app relies on. Each returns validated,
 * structured JSON or throws AiUnavailableError (see errors.ts).
 */
export interface AiClient {
  classifyProfessionalType(input: ClassifyInput): Promise<ClassifyOutput>;
  generateFollowUpQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GenerateQuestionsOutput>;
  matchProfessional(input: MatchInput): Promise<MatchOutput>;
  summarizePatient(input: SummarizeInput): Promise<SummarizeOutput>;
}
