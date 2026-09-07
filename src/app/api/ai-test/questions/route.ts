// TEMPORARY: verifies the generateQuestions AI call against real Gemini. Remove in Phase 10.
import { NextResponse } from "next/server";
import { ProfessionalType } from "@prisma/client";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await geminiClient.generateFollowUpQuestions({
      description: "I want to lose weight and improve my energy by eating better.",
      professionalType: ProfessionalType.NUTRITIONIST,
      standardFields: {
        age: 34,
        weightKg: 82,
        heightCm: 175,
        gender: "male",
        activityLevel: "light",
        allergies: "none",
      },
    });
    return NextResponse.json({ ok: true, count: result.questions.length, result });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
