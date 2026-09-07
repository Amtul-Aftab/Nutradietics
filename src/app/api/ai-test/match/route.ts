// TEMPORARY: verifies the match AI call against real Gemini using seeded
// sample candidates (no DB). Remove in Phase 10.
import { NextResponse } from "next/server";
import { ProfessionalType } from "@prisma/client";
import { geminiClient } from "@/lib/ai/gemini";
import { aiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await geminiClient.matchProfessional({
      description: "I want to lose weight and improve my energy by eating better.",
      standardFields: { age: 34, weightKg: 82, heightCm: 175 },
      answers: [
        { question: "Any dietary restrictions?", answer: "Vegetarian." },
        { question: "What is your main goal?", answer: "Lose 10kg over 6 months." },
      ],
      candidates: [
        {
          professionalId: "cand-1",
          type: ProfessionalType.NUTRITIONIST,
          specialty: "Weight management",
          serviceDescriptions: ["Personalized weight-loss meal plans"],
        },
        {
          professionalId: "cand-2",
          type: ProfessionalType.NUTRITIONIST,
          specialty: "Sports nutrition",
          serviceDescriptions: ["Fueling for endurance athletes"],
        },
      ],
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
