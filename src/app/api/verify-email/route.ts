import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Email verification consumer (Req 17). Emailed links are clicked as GET, so
// GET is the primary handler; POST shares the same logic per the spec. On a
// valid token: mark the user verified, delete the single-use token, and
// redirect to the sign-in page with a success flag. Verification is optional
// and never affects the ability to sign in.
async function handle(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.expiresAt < new Date()) {
    // Clean up an expired-but-present token so it can't linger.
    if (record) {
      await prisma.verificationToken
        .delete({ where: { id: record.id } })
        .catch(() => {});
    }
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  // Mark verified and consume the token atomically.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.redirect(new URL("/signin?verified=true", request.url));
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
