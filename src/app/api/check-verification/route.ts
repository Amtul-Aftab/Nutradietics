import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifyCookieUserId } from "@/lib/verify-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unauthenticated verification-status poll for the pending page (Req 17).
// Identifies the user solely from the signed _verifySessionId cookie set at
// signup. Returns a generic { emailVerified: false } when the cookie is
// missing/invalid or the user no longer exists, so nothing is revealed to
// anyone who doesn't already hold the signup session cookie (no enumeration).
export async function GET() {
  const userId = await getVerifyCookieUserId();
  if (!userId) {
    return NextResponse.json({ emailVerified: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });

  return NextResponse.json({ emailVerified: user?.emailVerified === true });
}
