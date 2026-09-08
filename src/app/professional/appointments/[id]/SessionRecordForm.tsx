"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, ErrorBanner } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface SessionRecordFormProps {
  appointmentId: string;
  initial: { diagnosis: string; plan: string } | null;
}

export function SessionRecordForm({
  appointmentId,
  initial,
}: SessionRecordFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const hasExisting = initial !== null;
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? "");
  const [plan, setPlan] = useState(initial?.plan ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);
    setSubmitting(true);

    const res = await fetch(
      `/api/appointments/${appointmentId}/session-record`,
      {
        method: hasExisting ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosis, plan }),
      },
    );

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      setError(data.error ?? "Unable to save the session record.");
      return;
    }

    setSaved(true);
    toast(hasExisting ? "Session record updated." : "Session record saved.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <ErrorBanner title="Could not save">
          <p>{error}</p>
        </ErrorBanner>
      )}
      {saved && <p className="form-saved">Session record saved.</p>}

      <FormField
        label="Diagnosis / assessment"
        htmlFor="diagnosis"
        required
        error={fieldErrors.diagnosis}
      >
        <textarea
          id="diagnosis"
          className="input textarea"
          rows={4}
          placeholder="Summarize your assessment and key findings from this session."
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          required
        />
      </FormField>

      <FormField
        label="Recommended plan"
        htmlFor="plan"
        required
        error={fieldErrors.plan}
      >
        <textarea
          id="plan"
          className="input textarea"
          rows={4}
          placeholder="Outline the recommended plan, next steps, and any follow-up."
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          required
        />
      </FormField>

      <Button type="submit" loading={submitting}>
        {submitting
          ? "Saving..."
          : hasExisting
            ? "Update record"
            : "Save record"}
      </Button>
    </form>
  );
}
