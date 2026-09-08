"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { dashboardPathForRole } from "@/lib/routes";

type RoleChoice = "CLIENT" | "PROFESSIONAL";
type TypeChoice = "NUTRITIONIST" | "FITNESS_TRAINER";

export default function SignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleChoice>("CLIENT");
  const [professionalType, setProfessionalType] =
    useState<TypeChoice>("NUTRITIONIST");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        professionalType: role === "PROFESSIONAL" ? professionalType : null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      setError(data.error ?? "Unable to create your account.");
      setSubmitting(false);
      return;
    }

    // Verification is optional and non-blocking; surface it as a toast that
    // survives the auto-login redirect below.
    toast("Account created! Check your email to verify.");

    // Auto sign-in after successful sign-up, then route by role.
    const signInRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!signInRes || signInRes.error) {
      // Account created but auto-login failed; send them to sign in manually.
      router.replace("/signin");
      return;
    }

    router.replace(dashboardPathForRole(role));
    router.refresh();
  }

  return (
    <main className="auth-page">
      <h1>Create your account</h1>
      {error && (
        <ErrorBanner title="Sign-up failed">
          <p>{error}</p>
        </ErrorBanner>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Name" htmlFor="name" hint="Optional">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </FormField>
        <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(fieldErrors.email)}
            required
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          hint="At least 8 characters"
          error={fieldErrors.password}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(fieldErrors.password)}
            required
          />
        </FormField>

        <FormField label="I am a" htmlFor="role" error={fieldErrors.role}>
          <select
            id="role"
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as RoleChoice)}
          >
            <option value="CLIENT">Client seeking help</option>
            <option value="PROFESSIONAL">Health professional</option>
          </select>
        </FormField>

        {role === "PROFESSIONAL" && (
          <FormField
            label="Professional type"
            htmlFor="professionalType"
            error={fieldErrors.professionalType}
          >
            <select
              id="professionalType"
              className="input"
              value={professionalType}
              onChange={(e) =>
                setProfessionalType(e.target.value as TypeChoice)
              }
            >
              <option value="NUTRITIONIST">Nutritionist</option>
              <option value="FITNESS_TRAINER">Fitness trainer</option>
            </select>
          </FormField>
        )}

        <p className="auth-page__hint">
          A verification email will be sent (verification is optional to
          proceed).
        </p>

        <Button type="submit" loading={submitting}>
          Sign up
        </Button>
      </form>
      <p className="auth-page__alt">
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </main>
  );
}
