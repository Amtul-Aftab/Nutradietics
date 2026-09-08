import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireClient } from "@/lib/client";

export const runtime = "nodejs";

// Client submits (or updates) a review for an appointment they own (Req 16).
// Gate (a): any appointment the client owns qualifies; one review per
// appointment (upsert on repeat, Req 16.3, 16.4).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { clientProfile } = await requireClient();
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment || appointment.clientProfileId !== clientProfile.id) {
      return NextResponse.json(
        { error: "Appointment not found." },
        { status: 404 },
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const body = (raw ?? {}) as Record<string, unknown>;

    const rating =
      typeof body.rating === "number" ? body.rating : Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a whole number from 1 to 5." },
        { status: 400 },
      );
    }

    const text =
      typeof body.text === "string" && body.text.trim().length > 0
        ? body.text.trim()
        : null;

    const review = await prisma.review.upsert({
      where: { appointmentId: appointment.id },
      create: {
        appointmentId: appointment.id,
        clientProfileId: clientProfile.id,
        professionalId: appointment.professionalId,
        rating,
        text,
      },
      update: { rating, text },
    });

    return NextResponse.json({
      review: { id: review.id, rating: review.rating, text: review.text },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
