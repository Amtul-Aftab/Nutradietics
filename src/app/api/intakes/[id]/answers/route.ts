import { NextResponse } from "next/server";
import { IntakeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, AuthError } from "@/lib/auth-helpers";
import { requireOwnedIntake } from "@/lib/client";

export const runtime = "nodejs";

// Persist the client's answers to the follow-up questions (Req 8.7); advances
// to ANSWERED. Body: { answers: { id: string; answer: string }[] }.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { intake } = await requireOwnedIntake(id);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const body = (raw ?? {}) as Record<string, unknown>;
    const answers = Array.isArray(body.answers) ? body.answers : null;
    if (!answers) {
      return NextResponse.json(
        { error: "answers must be an array." },
        { status: 400 },
      );
    }

    const questions = await prisma.followUpQuestion.findMany({
      where: { intakeId: intake.id },
    });
    if (questions.length === 0) {
      throw new AuthError(409, "No questions to answer yet.");
    }
    const questionIds = new Set(questions.map((q) => q.id));

    // Validate every answer targets a real question for this intake and is non-empty.
    const parsed: { id: string; answer: string }[] = [];
    for (const a of answers) {
      const rec = (a ?? {}) as Record<string, unknown>;
      const qid = typeof rec.id === "string" ? rec.id : "";
      const answer = typeof rec.answer === "string" ? rec.answer.trim() : "";
      if (!questionIds.has(qid) || !answer) {
        return NextResponse.json(
          { error: "Please answer all questions." },
          { status: 400 },
        );
      }
      parsed.push({ id: qid, answer });
    }
    if (parsed.length !== questions.length) {
      return NextResponse.json(
        { error: "Please answer all questions." },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      ...parsed.map((p) =>
        prisma.followUpQuestion.update({
          where: { id: p.id },
          data: { answer: p.answer },
        }),
      ),
      prisma.intake.update({
        where: { id: intake.id },
        data: { status: IntakeStatus.ANSWERED },
      }),
    ]);

    return NextResponse.json({ status: IntakeStatus.ANSWERED });
  } catch (error) {
    return authErrorResponse(error);
  }
}
