// TEMPORARY: verifies the summarize AI call against real Gemini. Remove in Phase 10.
import { NextResponse } from "next/server";
import { ProfessionalType } from "@prisma/client";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await geminiClient.summarizePatient({
      description: "I want to lose weight and improve my energy by eating better.",
      professionalType: ProfessionalType.NUTRITIONIST,
      standardFields: {
        age: 34,
        weightKg: 82,
        heightCm: 175,
        gender: "male",
        activityLevel: "light",
        medicalConditions: "mild hypertension",
        allergies: "none",
        currentSymptoms: "afternoon fatigue",
        recentReports: "Blood panel 2 months ago: slightly elevated cholesterol.",
      },
      answers: [
        { question: "Any dietary restrictions?", answer: "Vegetarian." },
        { question: "What is your main goal?", answer: "Lose 10kg over 6 months." },
      ],
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
