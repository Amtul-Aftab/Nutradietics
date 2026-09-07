import { GoogleGenAI, type Schema } from "@google/genai";
import { AiUnavailableError } from "./errors";
import {
  classifySchema,
  matchSchema,
  questionsSchema,
  summarizeSchema,
  validateClassify,
  validateMatch,
  validateQuestions,
  validateSummarize,
} from "./schemas";
import type {
  AiClient,
  ClassifyInput,
  ClassifyOutput,
  GenerateQuestionsInput,
  GenerateQuestionsOutput,
  MatchInput,
  MatchOutput,
  SummarizeInput,
  SummarizeOutput,
} from "./types";

const MODEL = "gemini-3.6-flash";
const DEFAULT_TIMEOUT_MS = 20000;

function timeoutMs(): number {
  const raw = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** Lazily construct the client so the key is read server-side at call time (Req 14.1). */
function getClient(): GoogleGenAI {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new AiUnavailableError("AI provider is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Shared resilience wrapper (Req 14.2, 14.3): enforces a timeout via
 * AbortController, requests structured JSON with a responseSchema, parses the
 * text, and hands the parsed value to a validator. Any failure becomes a
 * retryable AiUnavailableError.
 */
async function callAi<T>(args: {
  systemInstruction: string;
  prompt: string;
  responseSchema: Schema;
  validate: (parsed: unknown) => T | null;
}): Promise<T> {
  const { systemInstruction, prompt, responseSchema, validate } = args;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  let text: string | undefined;
  try {
    const client = getClient();
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        abortSignal: controller.signal,
      },
    });
    text = response.text;
  } catch (error) {
    throw new AiUnavailableError(
      "The AI request failed or timed out. Please try again.",
      error,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!text) {
    throw new AiUnavailableError("The AI returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new AiUnavailableError("The AI returned unparseable output.", error);
  }

  const validated = validate(parsed);
  if (validated === null) {
    throw new AiUnavailableError("The AI returned an unexpected response shape.");
  }
  return validated;
}

export const geminiClient: AiClient = {
  async classifyProfessionalType(
    input: ClassifyInput,
  ): Promise<ClassifyOutput> {
    return callAi({
      systemInstruction:
        "You classify a client's health need as exactly one professional type: " +
        "NUTRITIONIST (diet, nutrition, weight, eating) or FITNESS_TRAINER " +
        "(exercise, training, strength, mobility). Choose the single best fit.",
      prompt: `Client's described need:\n${input.description}`,
      responseSchema: classifySchema,
      validate: validateClassify,
    });
  },

  async generateFollowUpQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GenerateQuestionsOutput> {
    const lean =
      input.professionalType === "NUTRITIONIST"
        ? "Lean toward diet-related questions: eating patterns, dietary restrictions, and nutrition goals."
        : "Lean toward exercise-history and injury-related questions: training background, prior injuries, and physical limitations.";
    return callAi({
      systemInstruction:
        "You generate between 3 and 5 targeted follow-up questions to understand " +
        `a client's needs before matching them to a ${input.professionalType}. ${lean} ` +
        "Return only the questions.",
      prompt:
        `Client's need:\n${input.description}\n\n` +
        `Standard intake fields:\n${JSON.stringify(input.standardFields)}`,
      responseSchema: questionsSchema,
      validate: validateQuestions,
    });
  },

  async matchProfessional(input: MatchInput): Promise<MatchOutput> {
    const allowedIds = input.candidates.map((c) => c.professionalId);
    return callAi({
      systemInstruction:
        "You select the single best-fit professional for a client from the " +
        "provided candidates. You must choose a matchedProfessionalId that is " +
        "one of the given candidate ids, and briefly justify the choice.",
      prompt:
        `Client's need:\n${input.description}\n\n` +
        `Standard intake fields:\n${JSON.stringify(input.standardFields)}\n\n` +
        `Follow-up answers:\n${JSON.stringify(input.answers)}\n\n` +
        `Candidates:\n${JSON.stringify(input.candidates)}`,
      responseSchema: matchSchema,
      validate: (parsed) => validateMatch(parsed, allowedIds),
    });
  },

  async summarizePatient(input: SummarizeInput): Promise<SummarizeOutput> {
    return callAi({
      systemInstruction:
        "You write a concise summary of a client for the matched professional " +
        `(${input.professionalType}) to review before the appointment, so they ` +
        "understand the client's situation quickly. Be factual; do not invent details.",
      prompt:
        `Client's need:\n${input.description}\n\n` +
        `Standard intake fields:\n${JSON.stringify(input.standardFields)}\n\n` +
        `Follow-up answers:\n${JSON.stringify(input.answers)}`,
      responseSchema: summarizeSchema,
      validate: validateSummarize,
    });
  },
};
