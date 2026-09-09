import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getVerifyCookieUserId } from "@/lib/verify-session";
import { VerifyPendingClient } from "./VerifyPendingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your email" };

// Unauthenticated page shown right after signup. The user is identified from
// the signed _verifySessionId cookie (never from the URL), so we can show the
// email they signed up with and poll their verification status (Req 17).
export default async function VerifyEmailPendingPage() {
  const userId = await getVerifyCookieUserId();
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true },
      })
    : null;

  // No valid session cookie (direct navigation, expired, or cleared).
  if (!user) {
    return (
      <main className="auth-page">
        <h1>Verify your email</h1>
        <p className="auth-page__hint">
          We couldn&apos;t find a pending verification for this device. If you
          just signed up, open the verification link from your email. Otherwise
          you can <Link href="/signup">create an account</Link> or{" "}
          <Link href="/signin">sign in</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <h1>Account created!</h1>
      <p>
        Check your email to verify your address. You must verify to access your
        account.
      </p>
      <p className="auth-page__hint">
        We sent a verification link to <strong>{user.email}</strong>.
      </p>
      <VerifyPendingClient initiallyVerified={user.emailVerified} />
      <p className="auth-page__alt">
        Already verified? <Link href="/signin">Sign in</Link>
      </p>
    </main>
  );
}
