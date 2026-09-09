"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const POLL_INTERVAL_MS = 5000;

export function VerifyPendingClient({
  initiallyVerified,
}: {
  initiallyVerified: boolean;
}) {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const redirected = useRef(false);

  function goToSignin() {
    if (redirected.current) return;
    redirected.current = true;
    router.replace("/signin?verified=true");
  }

  // Poll verification status every 5s; redirect to sign-in once verified.
  useEffect(() => {
    if (initiallyVerified) {
      goToSignin();
      return;
    }

    let active = true;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/check-verification", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: { emailVerified?: boolean } = await res.json();
        if (active && data.emailVerified) {
          clearInterval(timer);
          goToSignin();
        }
      } catch {
        // Transient network error; the next tick will retry.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiallyVerified]);

  async function onResend() {
    setResending(true);
    setResent(false);
    try {
      await fetch("/api/resend-verification", { method: "POST" });
      setResent(true);
    } catch {
      // Best-effort; button can be pressed again.
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="verify-pending">
      <p className="verify-pending__status" role="status" aria-live="polite">
        <span className="verify-pending__spinner" aria-hidden="true" />
        Waiting for email verification...
      </p>
      <Button type="button" variant="secondary" onClick={onResend} loading={resending}>
        {resending ? "Sending..." : "Resend verification email"}
      </Button>
      {resent && (
        <p className="auth-page__hint" role="status">
          Verification email sent. Check your inbox (and spam folder).
        </p>
      )}
    </div>
  );
}
