import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { canAccessMedicalHistory, getMedicalHistory } from "@/lib/medical-history";

export const runtime = "nodejs";

// Client medical history, gated to self or a professional booked with the
// client (Req 13.2, 13.5). clientId is the ClientProfile id.
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

    const history = await getMedicalHistory(clientId);
    return NextResponse.json({ history });
  } catch (error) {
    return authErrorResponse(error);
  }
}
