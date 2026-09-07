import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireClient } from "@/lib/client";
import { getMedicalHistory } from "@/lib/medical-history";

export const runtime = "nodejs";

// The signed-in client's own complete medical history (Req 13.6).
export async function GET() {
  try {
    const { clientProfile } = await requireClient();
    const history = await getMedicalHistory(clientProfile.id);
    return NextResponse.json({ history });
  } catch (error) {
    return authErrorResponse(error);
  }
}
