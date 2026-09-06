import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";
import { validateService } from "@/lib/professional-validation";

export const runtime = "nodejs";

// List the current professional's active services (Req 3.4).
export async function GET() {
  try {
    const { professional } = await requireProfessional();
    const services = await prisma.service.findMany({
      where: { professionalId: professional.id, active: true },
      orderBy: { specialty: "asc" },
    });
    return NextResponse.json({ services });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// Create a service; type is denormalized from the professional (Req 3.1).
export async function POST(request: Request) {
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

    const result = validateService(raw);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Validation failed.", fieldErrors: result.errors },
        { status: 400 },
      );
    }

    const { specialty, description, priceCents, active } = result.value;
    const service = await prisma.service.create({
      data: {
        professionalId: professional.id,
        type: professional.type, // denormalized for match filtering (Req 3.1)
        specialty,
        description,
        priceCents,
        active,
      },
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
