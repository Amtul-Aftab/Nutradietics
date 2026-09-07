import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";
import { validateSessionRecord } from "@/lib/session-record-validation";

export const runtime = "nodejs";

/**
 * Loads the appointment and verifies it belongs to the current professional.
 * Returns the appointment (with any existing session record) or a Response to
 * short-circuit on error.
 */
async function loadOwnedAppointment(
  appointmentId: string,
  professionalId: string,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { sessionRecord: true },
  });
  if (!appointment || appointment.professionalId !== professionalId) {
    return null;
  }
  return appointment;
}

// Create the diagnosis/plan for a completed appointment (Req 12.1-12.3).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { professional } = await requireProfessional();
    const { id } = await params;

    const appointment = await loadOwnedAppointment(id, professional.id);
    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found." },
        { status: 404 },
      );
    }
    if (appointment.sessionRecord) {
      return NextResponse.json(
        { error: "A session record already exists. Use PUT to edit it." },
        { status: 409 },
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const result = validateSessionRecord(raw);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Validation failed.", fieldErrors: result.errors },
        { status: 400 },
      );
    }

    const record = await prisma.sessionRecord.create({
      data: {
        appointmentId: appointment.id,
        professionalId: professional.id, // author (Req 12.6)
        diagnosis: result.value.diagnosis,
        plan: result.value.plan,
      },
    });

    return NextResponse.json({ sessionRecord: record }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// Edit an existing session record; only the authoring professional (Req 12.4, 12.6).
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { professional } = await requireProfessional();
    const { id } = await params;

    const appointment = await loadOwnedAppointment(id, professional.id);
    if (!appointment || !appointment.sessionRecord) {
      return NextResponse.json(
        { error: "Session record not found." },
        { status: 404 },
      );
    }
    // Author-only edit guard (Req 12.6).
    if (appointment.sessionRecord.professionalId !== professional.id) {
      return NextResponse.json(
        { error: "You do not have access to this record." },
        { status: 403 },
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const result = validateSessionRecord(raw);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Validation failed.", fieldErrors: result.errors },
        { status: 400 },
      );
    }

    const record = await prisma.sessionRecord.update({
      where: { appointmentId: appointment.id },
      data: { diagnosis: result.value.diagnosis, plan: result.value.plan },
    });

    return NextResponse.json({ sessionRecord: record });
  } catch (error) {
    return authErrorResponse(error);
  }
}
