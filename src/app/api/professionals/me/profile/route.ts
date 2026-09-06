import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";
import { validateProfile } from "@/lib/professional-validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { professional } = await requireProfessional();
    return NextResponse.json({ professional });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { professional } = await requireProfessional();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const result = validateProfile(raw);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Validation failed.", fieldErrors: result.errors },
        { status: 400 },
      );
    }

    const { name, type, specialty, bio } = result.value;
    const updated = await prisma.professional.update({
      where: { id: professional.id },
      data: { name, type, specialty, bio },
    });

    return NextResponse.json({ professional: updated });
  } catch (error) {
    return authErrorResponse(error);
  }
}
