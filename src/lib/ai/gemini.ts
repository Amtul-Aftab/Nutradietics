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
// The summarize call is a longer free-text generation than the structured
// classify/questions/match calls, so the default is generous. Override via
// AI_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS = 45000;

function timeoutMs(): number {
  const raw = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * The configured API keys (AI_API_KEY, AI_API_KEY_2, AI_API_KEY_3). Empty /
 * undefined keys are filtered out, so the app degrades gracefully to fewer
 * keys (or single-key behavior) when not all are set. The order here is the
 * fallback order within a single call; the *starting* key rotates per call
 * (see callAi round-robin) to spread quota usage evenly across keys.
 */
function apiKeys(): string[] {
  return [
    process.env.AI_API_KEY,
    process.env.AI_API_KEY_2,
    process.env.AI_API_KEY_3,
  ]
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k));
}

// Round-robin cursor: advances once per AI call so each new call starts with a
// different key, spreading daily quota usage evenly instead of always hitting
// key 1 first. Module-scoped (per server instance); exact fairness across
// serverless instances isn't required — the goal is even-ish distribution.
let roundRobinCursor = 0;

/** Construct a client for a specific key (read server-side at call time, Req 14.1). */
function clientForKey(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

/**
 * Detects a rate-limit failure. The @google/genai SDK throws an `ApiError`
 * carrying a numeric `status`, so a 429 is the primary signal; we also match
 * common rate-limit text as a defensive fallback for transport-layer variants.
 */
function isRateLimitError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (status === 429) return true;
    const code = (error as { code?: unknown }).code;
    if (code === 429) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|rate limit|too many requests|resource_exhausted|quota/i.test(
    message,
  );
}

/**
 * Performs a single Gemini generateContent call with the given key, under a
 * timeout. Errors propagate raw so the caller can inspect them for failover;
 * this function does not wrap them into AiUnavailableError.
 */
async function generateWithKey(
  apiKey: string,
  args: {
    systemInstruction: string;
    prompt: string;
    responseSchema: Schema;
  },
): Promise<string | undefined> {
  const { systemInstruction, prompt, responseSchema } = args;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const client = clientForKey(apiKey);
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
    return response.text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shared resilience wrapper (Req 14.2, 14.3): enforces a timeout via
 * AbortController, requests structured JSON with a responseSchema, parses the
 * text, and hands the parsed value to a validator. Any failure becomes a
 * retryable AiUnavailableError.
 *
 * Automatic key failover with round-robin (AI_API_KEY, AI_API_KEY_2,
 * AI_API_KEY_3): each new call starts with a different key (rotating cursor)
 * to spread quota usage evenly. If — and only if — that call fails with a
 * rate-limit error (429), the request falls through the remaining keys in
 * order until one succeeds. Any non-429 error fails fast without burning the
 * other keys, and a 429 on the last-tried key surfaces as the retryable error.
 */
async function callAi<T>(args: {
  systemInstruction: string;
  prompt: string;
  responseSchema: Schema;
  validate: (parsed: unknown) => T | null;
}): Promise<T> {
  const { systemInstruction, prompt, responseSchema, validate } = args;

  const keys = apiKeys();
  if (keys.length === 0) {
    throw new AiUnavailableError("AI provider is not configured.");
  }

  // Rotate the starting key per call, then fall through the rest in order.
  const start = roundRobinCursor % keys.length;
  roundRobinCursor = (roundRobinCursor + 1) % keys.length;

  let text: string | undefined;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[(start + i) % keys.length];
    try {
      text = await generateWithKey(key, {
        systemInstruction,
        prompt,
        responseSchema,
      });
      break;
    } catch (error) {
      // Only a rate-limit error justifies trying the next key; anything else
      // (timeout, bad request, transport failure) fails immediately. If this
      // was the last key to try, or the error isn't a 429, surface it as
      // retryable.
      const canFailover = isRateLimitError(error) && i < keys.length - 1;
      if (!canFailover) {
        throw new AiUnavailableError(
          "The AI request failed or timed out. Please try again.",
          error,
        );
      }
      // else: fall through to retry with the next key in the rotation.
    }
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
