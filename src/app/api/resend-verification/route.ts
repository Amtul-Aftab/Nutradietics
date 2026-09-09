import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifyCookieUserId } from "@/lib/verify-session";
import {
  generateVerificationToken,
  sendVerificationEmail,
} from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Re-send the verification email for the current signup session (Req 17).
// Identifies the user from the signed _verifySessionId cookie only. Always
// responds with a generic { ok: true } regardless of whether a matching
// unverified user was found, so it can't be used to probe account state.
export async function POST() {
  const userId = await getVerifyCookieUserId();
  if (!userId) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true },
  });

  // Nothing to do if already verified or the user is gone — respond generically.
  if (!user || user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  // Rotate the token: drop any existing ones, issue a fresh 24h token.
  const token = generateVerificationToken();
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.verificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    }),
  ]);

  await sendVerificationEmail(user.email, token);

  return NextResponse.json({ ok: true });
}
