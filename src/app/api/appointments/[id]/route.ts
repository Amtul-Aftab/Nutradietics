import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";

export const runtime = "nodejs";

/**
 * Professional updates their own appointment's meeting link and/or payment
 * status (Req 11.6, 11.7). Only the owning professional may update; payment can
 * be toggled to PAID (or back to PENDING) to reflect off-platform payment.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { professional } = await requireProfessional();
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment || appointment.professionalId !== professional.id) {
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

    const data: { meetingLink?: string | null; paymentStatus?: PaymentStatus } =
      {};

    if ("meetingLink" in body) {
      const link =
        typeof body.meetingLink === "string" ? body.meetingLink.trim() : "";
      data.meetingLink = link.length > 0 ? link : null;
    }

    if ("paymentStatus" in body) {
      const ps = body.paymentStatus;
      if (ps !== PaymentStatus.PENDING && ps !== PaymentStatus.PAID) {
        return NextResponse.json(
          { error: "Invalid payment status." },
          { status: 400 },
        );
      }
      data.paymentStatus = ps;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 },
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data,
    });

    return NextResponse.json({
      meetingLink: updated.meetingLink,
      paymentStatus: updated.paymentStatus,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
