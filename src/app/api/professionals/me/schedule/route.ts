import { NextResponse } from "next/server";
import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";

export const runtime = "nodejs";

// Appointments booked against the current professional's slots (Req 11.5).
export async function GET() {
  try {
    const { professional } = await requireProfessional();
    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId: professional.id,
        status: { not: AppointmentStatus.CANCELLED },
      },
      include: {
        timeSlot: true,
        clientProfile: { include: { user: { select: { email: true } } } },
      },
      orderBy: { timeSlot: { startsAt: "asc" } },
    });
    return NextResponse.json({ appointments });
  } catch (error) {
    return authErrorResponse(error);
  }
}
