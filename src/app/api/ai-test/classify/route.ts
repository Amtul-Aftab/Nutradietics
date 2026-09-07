// TEMPORARY: verifies the classify AI call against real Gemini. Remove in Phase 10.
import { NextResponse } from "next/server";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await geminiClient.classifyProfessionalType({
      description:
        "I want to lose weight and improve my energy by eating better.",
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
