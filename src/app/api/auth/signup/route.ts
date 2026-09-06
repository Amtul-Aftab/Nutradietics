import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { validateSignup } from "@/lib/auth-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = validateSignup(raw);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Validation failed.", fieldErrors: result.errors },
      { status: 400 },
    );
  }

  const { email, password, role, professionalType, name } = result.value;
  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, role },
      });

      if (role === Role.PROFESSIONAL) {
        await tx.professional.create({
          data: {
            userId: user.id,
            name: name ?? email.split("@")[0],
            // professionalType is guaranteed present for professionals by validation.
            type: professionalType!,
            specialty: "",
          },
        });
      } else {
        await tx.clientProfile.create({
          data: { userId: user.id, name: name ?? null },
        });
      }
    });
  } catch (error) {
    // Unique constraint violation on email — respond generically (Req 1.3).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Unable to create an account with those details." },
        { status: 409 },
      );
    }
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
