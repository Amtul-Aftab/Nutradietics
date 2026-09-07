import { NextResponse } from "next/server";

/**
 * Thrown for any AI failure the caller should treat as retryable: timeout,
 * non-JSON output, schema mismatch, or an out-of-range value (Req 14.2, 14.3).
 */
export class AiUnavailableError extends Error {
  cause?: unknown;
  constructor(message = "The AI service is temporarily unavailable.", cause?: unknown) {
    super(message);
    this.name = "AiUnavailableError";
    this.cause = cause;
  }
}

/**
 * Maps an AiUnavailableError to a retryable 503 JSON response so the UI can
 * offer a retry while preserving the user's input (Req 14.2, 14.3).
 * Re-throws anything that isn't an AI error for the caller to handle.
 */
export function aiErrorResponse(error: unknown): NextResponse {
  if (error instanceof AiUnavailableError) {
    return NextResponse.json(
      { error: error.message, retryable: true },
      { status: 503 },
    );
  }
  throw error;
}
