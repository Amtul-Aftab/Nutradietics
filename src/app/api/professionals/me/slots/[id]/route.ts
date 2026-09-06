import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";
import { removeSlot, SlotBookedError, SlotNotFoundError } from "@/lib/slots";

export const runtime = "nodejs";

// Remove a slot the current professional owns; only if not booked (Req 4.5).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { professional } = await requireProfessional();
    const { id } = await params;

    await removeSlot(professional.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SlotNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SlotBookedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
