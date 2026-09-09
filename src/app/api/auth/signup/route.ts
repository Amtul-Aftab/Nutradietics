import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { validateSignup } from "@/lib/auth-validation";
import {
  generateVerificationToken,
  sendVerificationEmail,
} from "@/lib/email";
import { setVerifyCookie } from "@/lib/verify-session";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  // Generated up front so we can persist it in the same transaction as the
  // user (rolls back with signup) and email it after the commit succeeds.
  const verificationToken = generateVerificationToken();

  let newUserId: string;
  try {
    newUserId = await prisma.$transaction(async (tx) => {
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

      // Issue a single-use email verification token (Req 17). Verification is
      // now required to sign in; this token backs the emailed verify link.
      await tx.verificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
        },
      });

      return user.id;
    }, {
      // Remote Supabase adds network latency; give the interactive transaction
      // more room than Prisma's 5s default to acquire a connection and commit.
      maxWait: 15000, // max time to wait for a connection from the pool
      timeout: 15000, // max time the transaction may run once started
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

  // Set the short-lived signed verification-session cookie so the pending
  // page + check-verification endpoint can identify this user without auth
  // and without exposing the email in the URL (Req 17).
  await setVerifyCookie(newUserId);

  // Best-effort verification email AFTER the account is safely committed. A
  // send failure is logged inside the helper and does not fail signup — the
  // user lands on the pending page and can use "Resend" (Req 17).
  await sendVerificationEmail(email, verificationToken);

  return NextResponse.json(
    {
      ok: true,
      message:
        "Account created! Check your email to verify your address. You must verify to access your account.",
    },
    { status: 201 },
  );
}
