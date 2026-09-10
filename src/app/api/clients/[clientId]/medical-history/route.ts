import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  canAccessMedicalHistory,
  getMedicalHistory,
  type ProfessionalContext,
} from "@/lib/medical-history";

export const runtime = "nodejs";

// Client medical history, gated to self or a professional booked with the
// client (Req 13.2, 13.5). clientId is the ClientProfile id.
//
// When the viewer is a professional the result is scoped to their discipline
// and their own session records — no cross-professional data leakage (Req 13.5).
// When the viewer is the client they receive their full history (Req 13.6).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const session = await requireUser();
    const { clientId } = await params;

    const allowed = await canAccessMedicalHistory(clientId, {
      role: session.user.role,
      userId: session.user.id,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have access to this history." },
        { status: 403 },
      );
    }

    // Build professional context so getMedicalHistory can scope its queries.
    // For a client viewer this stays undefined and all records are returned.
    let professionalContext: ProfessionalContext | undefined;
    if (session.user.role === Role.PROFESSIONAL) {
      const professional = await prisma.professional.findUnique({
        where: { userId: session.user.id },
        select: { id: true, type: true },
      });
      if (professional) {
        professionalContext = {
          professionalId: professional.id,
          professionalType: professional.type,
        };
      }
    }

    const history = await getMedicalHistory(clientId, professionalContext);
    return NextResponse.json({ history });
  } catch (error) {
    return authErrorResponse(error);
  }
}
