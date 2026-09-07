// TEMPORARY: Gemini connectivity check. Calls one AiClient method with a
// hardcoded sample input so we can confirm the AI provider works end-to-end.
// Remove before Phase 7.
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
