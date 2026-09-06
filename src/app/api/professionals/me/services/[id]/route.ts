import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/lib/auth-helpers";
import { requireProfessional } from "@/lib/professional";
import { validateService } from "@/lib/professional-validation";

export const runtime = "nodejs";

// Update a service the current professional owns.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { professional } = await requireProfessional();
    const { id } = await params;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.professionalId !== professional.id) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

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
    const service = await prisma.service.update({
      where: { id },
      data: { specialty, description, priceCents, active },
    });

    return NextResponse.json({ service });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// Remove a service the current professional owns.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { professional } = await requireProfessional();
    const { id } = await params;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.professionalId !== professional.id) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
