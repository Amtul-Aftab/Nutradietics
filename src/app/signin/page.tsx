"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";
import { dashboardPathForRole } from "@/lib/routes";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justVerified = searchParams.get("verified") === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!res || res.error) {
      // Generic message — do not reveal which field was wrong (Req 1.5).
      // Email verification is non-blocking, so there is no "unverified" case.
      setError("Invalid email or password.");
      setSubmitting(false);
      return;
    }

    // Route by role based on the freshly established session.
    const session = await getSession();
    const role = session?.user?.role;
    router.replace(role ? dashboardPathForRole(role) : "/");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <h1>Sign in</h1>
      {justVerified && (
        <p className="auth-page__success" role="status">
          Email verified! You can now sign in.
        </p>
      )}
      {error && (
        <ErrorBanner title="Sign-in failed">
          <p>{error}</p>
        </ErrorBanner>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
        <Button type="submit" loading={submitting}>
          Sign in
        </Button>
      </form>
      <p className="auth-page__alt">
        Need an account? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}

export default function SignInPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
