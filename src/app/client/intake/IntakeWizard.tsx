"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, ErrorBanner } from "@/components/ui";
import {
  INTAKE_STEPS,
  STEP_LABELS,
  type IntakeStep,
} from "@/lib/intake-steps";

interface IntakeWizardProps {
  step: IntakeStep;
  // The current intake's description, if one exists (for display on resume).
  description: string | null;
}

export function IntakeWizard({ step, description }: IntakeWizardProps) {
  const router = useRouter();
  const [value, setValue] = useState(description ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitDescription(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setSubmitting(true);

    const res = await fetch("/api/intakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: value }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.fieldErrors?.description) {
        setFieldError(data.fieldErrors.description);
      } else {
        setError(data.error ?? "Unable to start your intake.");
      }
      return;
    }

    // Advance the wizard: the server re-reads the new intake status on refresh.
    router.refresh();
  }

  const currentIndex = INTAKE_STEPS.indexOf(step);

  return (
    <div className="wizard">
      <ol className="wizard__steps">
        {INTAKE_STEPS.map((s, i) => (
          <li
            key={s}
            className={
              i === currentIndex
                ? "wizard__step wizard__step--active"
                : i < currentIndex
                  ? "wizard__step wizard__step--done"
                  : "wizard__step"
            }
          >
            {STEP_LABELS[s]}
          </li>
        ))}
      </ol>

      <section className="wizard__panel">
        {step === "DESCRIBE" ? (
          <form onSubmit={submitDescription} noValidate>
            <h2>Describe your needs</h2>
            <p className="appointment__hint">
              In your own words, tell us what you&apos;d like help with. For
              example: &ldquo;I want to lose weight and improve my energy.&rdquo;
            </p>
            {error && (
              <ErrorBanner title="Could not start">
                <p>{error}</p>
              </ErrorBanner>
            )}
            <FormField
              label="What do you need help with?"
              htmlFor="description"
              error={fieldError ?? undefined}
            >
              <textarea
                id="description"
                className="input textarea"
                rows={5}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </FormField>
            <Button type="submit" loading={submitting}>
              Continue
            </Button>
          </form>
        ) : (
          <div className="wizard__pending">
            <h2>{STEP_LABELS[step]}</h2>
            <p className="appointment__hint">
              This step is coming soon. Your progress is saved — you can pick up
              here once it&apos;s available.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
