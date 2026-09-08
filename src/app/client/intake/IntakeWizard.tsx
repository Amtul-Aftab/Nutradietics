"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import {
  INTAKE_STEPS,
  STEP_LABELS,
  type IntakeStep,
} from "@/lib/intake-steps";
import type { FieldSpec } from "@/lib/standard-fields";
import { Avatar } from "@/components/Avatar";
import { RatingBadge } from "@/components/RatingBadge";
import { CrossTypeSuggestion } from "./CrossTypeSuggestion";

interface QuestionData {
  id: string;
  question: string;
  answer: string | null;
}

interface MatchData {
  professionalId: string;
  name: string;
  type: "NUTRITIONIST" | "FITNESS_TRAINER";
  specialty: string;
  bio: string | null;
  avatarUrl: string | null;
  rating: { average: number | null; count: number };
  rationale: string;
  slots: { id: string; startsAt: string; endsAt: string }[];
  suggestion: { message: string; otherTypeLabel: string } | null;
}

export interface WizardData {
  step: IntakeStep;
  intakeId: string | null;
  description: string | null;
  professionalType: "NUTRITIONIST" | "FITNESS_TRAINER" | null;
  fields: FieldSpec[];
  standardFields: Record<string, unknown> | null;
  questions: QuestionData[];
  match: MatchData | null;
}

function typeLabel(t: "NUTRITIONIST" | "FITNESS_TRAINER"): string {
  return t === "NUTRITIONIST" ? "Nutritionist" : "Fitness trainer";
}

function formatRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${date}, ${start.toLocaleTimeString(undefined, opts)} - ${end.toLocaleTimeString(undefined, opts)}`;
}

export function IntakeWizard({ data }: { data: WizardData }) {
  const router = useRouter();
  const currentIndex = INTAKE_STEPS.indexOf(data.step);

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
        {data.step === "DESCRIBE" && <DescribeStep router={router} data={data} />}
        {data.step === "CLASSIFY" && <ClassifyStep router={router} data={data} />}
        {data.step === "FIELDS" && <FieldsStep router={router} data={data} />}
        {data.step === "QUESTIONS" && <QuestionsStep router={router} data={data} />}
        {data.step === "MATCH" && <MatchStep router={router} data={data} />}
        {data.step === "BOOK" && <BookStep router={router} data={data} />}
      </section>
    </div>
  );
}

type Router = ReturnType<typeof useRouter>;
interface StepProps {
  router: Router;
  data: WizardData;
}

// --- DESCRIBE: plain-language description form --------------------------------
function DescribeStep({ router, data }: StepProps) {
  const [value, setValue] = useState(data.description ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
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
      const d = await res.json().catch(() => ({}));
      if (d.fieldErrors?.description) setFieldError(d.fieldErrors.description);
      else setError(d.error ?? "Unable to start your intake.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2>Describe your needs</h2>
      <p className="appointment__hint">
        In your own words, tell us what you&apos;d like help with. For example:
        &ldquo;I want to lose weight and improve my energy.&rdquo;
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
  );
}

// --- CLASSIFY: auto AI step with spinner + retry ------------------------------
function ClassifyStep({ router, data }: StepProps) {
  const { error, retrying, run } = useAutoAi(
    `/api/intakes/${data.intakeId}/classify`,
    router,
  );
  return (
    <AutoAiPanel
      title="Finding the right type of professional"
      pendingText="Analyzing your needs to determine whether a nutritionist or fitness trainer is the best fit..."
      error={error}
      retrying={retrying}
      onRetry={run}
    />
  );
}

// --- FIELDS: type-specific standard fields form -------------------------------
function FieldsStep({ router, data }: StepProps) {
  const initial: Record<string, string> = {};
  for (const f of data.fields) {
    const existing = data.standardFields?.[f.key];
    initial[f.key] = existing != null ? String(existing) : "";
  }
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    // Coerce numbers; drop empty optional fields.
    const payload: Record<string, unknown> = {};
    for (const f of data.fields) {
      const v = values[f.key]?.trim() ?? "";
      if (v === "") continue;
      payload[f.key] = f.kind === "number" ? Number(v) : v;
    }

    const res = await fetch(`/api/intakes/${data.intakeId}/standard-fields`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      if (d.fieldErrors) setFieldErrors(d.fieldErrors);
      else setError(d.error ?? "Unable to save your details.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2>A few health details</h2>
      <p className="appointment__hint">
        These help your {data.professionalType ? typeLabel(data.professionalType).toLowerCase() : "professional"} understand your baseline.
      </p>
      {error && (
        <ErrorBanner title="Could not save">
          <p>{error}</p>
        </ErrorBanner>
      )}
      {data.fields.map((f) => (
        <FormField
          key={f.key}
          label={f.label}
          htmlFor={f.key}
          required={f.required}
          hint={f.hint}
          error={fieldErrors[f.key]}
        >
          {f.kind === "select" ? (
            <select
              id={f.key}
              className="input"
              value={values[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
            >
              <option value="">Select...</option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : f.kind === "textarea" ? (
            <textarea
              id={f.key}
              className="input textarea"
              rows={2}
              value={values[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          ) : (
            <Input
              id={f.key}
              type={f.kind === "number" ? "number" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
              invalid={Boolean(fieldErrors[f.key])}
            />
          )}
        </FormField>
      ))}
      <Button type="submit" loading={submitting}>
        Continue
      </Button>
    </form>
  );
}

// --- QUESTIONS: auto-generate (if needed) then answer form --------------------
function QuestionsStep({ router, data }: StepProps) {
  const hasQuestions = data.questions.length > 0;

  // Generate questions automatically when none exist yet.
  const generate = useAutoAi(
    `/api/intakes/${data.intakeId}/questions`,
    router,
    !hasQuestions, // only auto-run when we still need to generate
  );

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of data.questions) init[q.id] = q.answer ?? "";
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!hasQuestions) {
    return (
      <AutoAiPanel
        title="Follow-up questions"
        pendingText="Preparing a few tailored questions based on what you told us..."
        error={generate.error}
        retrying={generate.retrying}
        onRetry={generate.run}
      />
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/intakes/${data.intakeId}/answers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: data.questions.map((q) => ({
          id: q.id,
          answer: answers[q.id] ?? "",
        })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Please answer all questions.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2>Follow-up questions</h2>
      <p className="appointment__hint">
        A few tailored questions to understand your situation.
      </p>
      {error && (
        <ErrorBanner title="Could not submit">
          <p>{error}</p>
        </ErrorBanner>
      )}
      {data.questions.map((q, i) => (
        <FormField key={q.id} label={`${i + 1}. ${q.question}`} htmlFor={q.id} required>
          <textarea
            id={q.id}
            className="input textarea"
            rows={2}
            value={answers[q.id] ?? ""}
            onChange={(e) =>
              setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
            }
            required
          />
        </FormField>
      ))}
      <Button type="submit" loading={submitting}>
        Continue
      </Button>
    </form>
  );
}

// --- MATCH: auto AI step with spinner + retry / no-match ----------------------
function MatchStep({ router, data }: StepProps) {
  const [noMatch, setNoMatch] = useState(false);
  const { error, retrying, run } = useAutoAi(
    `/api/intakes/${data.intakeId}/match`,
    router,
    true,
    (json) => {
      // A 200 with match: null means no candidates were available (Req 9.5).
      if (
        json &&
        typeof json === "object" &&
        "match" in json &&
        (json as { match: unknown }).match === null
      ) {
        setNoMatch(true);
      }
    },
  );

  if (noMatch) {
    return (
      <div className="wizard__pending">
        <h2>No match available yet</h2>
        <p className="appointment__hint">
          We couldn&apos;t find an available professional of the right type right
          now. Please check back later.
        </p>
        <Button variant="secondary" onClick={run} loading={retrying}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <AutoAiPanel
      title="Finding your best match"
      pendingText="Matching you with the best-fit professional based on your intake..."
      error={error}
      retrying={retrying}
      onRetry={run}
    />
  );
}

// --- BOOK: matched professional + rationale + slot picker (Req 9.4, 11.1) -----
function BookStep({ router, data }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);

  if (!data.match) {
    return (
      <div className="wizard__pending">
        <h2>Your match</h2>
        <p className="appointment__hint">Loading your match...</p>
      </div>
    );
  }
  const m = data.match;

  async function book(slotId: string) {
    setError(null);
    setBookingSlotId(slotId);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeId: data.intakeId, timeSlotId: slotId }),
    });
    setBookingSlotId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Unable to book that slot.");
      if (res.status === 409) router.refresh();
      return;
    }
    setConfirmation(true);
    router.refresh();
  }

  if (confirmation) {
    return (
      <div className="wizard__pending">
        <h2>Appointment confirmed</h2>
        <p className="form-saved">
          You&apos;re booked with {m.name}. See your dashboard for details.
        </p>
        {m.suggestion && (
          <CrossTypeSuggestion
            message={m.suggestion.message}
            otherTypeLabel={m.suggestion.otherTypeLabel}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <h2>Your match</h2>
      <article className="browse__card">
        <header className="browse__card-header">
          <Avatar url={m.avatarUrl} name={m.name} size={56} />
          <div>
            <h2>{m.name}</h2>
            <span className="slots__badge slots__badge--available">
              {typeLabel(m.type)}
            </span>
          </div>
        </header>
        <p className="browse__rating">
          <RatingBadge average={m.rating.average} count={m.rating.count} />
        </p>
        <p className="browse__specialty">{m.specialty}</p>
        {m.bio && <p className="browse__bio">{m.bio}</p>}
        <h3>Why we matched you</h3>
        <p className="browse__bio">{m.rationale}</p>
        <p className="match__trust">
          Matched from your intake — you&apos;re always free to review the
          details before booking, and your information is only shared with the
          professional you choose.
        </p>

        <h3>Available times</h3>
        {error && (
          <ErrorBanner title="Booking issue">
            <p>{error}</p>
          </ErrorBanner>
        )}
        {m.slots.length === 0 ? (
          <p className="slots__empty">No open slots right now.</p>
        ) : (
          <ul className="browse__slots">
            {m.slots.map((s) => (
              <li key={s.id}>
                <span>{formatRange(s.startsAt, s.endsAt)}</span>
                <Button
                  onClick={() => book(s.id)}
                  loading={bookingSlotId === s.id}
                >
                  Book
                </Button>
              </li>
            ))}
          </ul>
        )}
      </article>

      {m.suggestion && (
        <CrossTypeSuggestion
          message={m.suggestion.message}
          otherTypeLabel={m.suggestion.otherTypeLabel}
        />
      )}
    </div>
  );
}

// --- Shared: auto-firing AI step hook + panel ---------------------------------
function useAutoAi(
  url: string,
  router: Router,
  enabled = true,
  onSuccess?: (json: unknown) => void,
) {
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const fired = useRef(false);

  async function run() {
    setError(null);
    setRetrying(true);
    try {
      const res = await fetch(url, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Retryable AI errors preserve prior input (state lives server-side).
        setError(json.error ?? "The AI step failed. Please try again.");
        setRetrying(false);
        return;
      }
      if (onSuccess) onSuccess(json);
      // Advance: server re-derives the step from the new intake status.
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setRetrying(false);
    }
  }

  useEffect(() => {
    if (enabled && !fired.current) {
      fired.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { error, retrying, run };
}

function AutoAiPanel({
  title,
  pendingText,
  error,
  retrying,
  onRetry,
}: {
  title: string;
  pendingText: string;
  error: string | null;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="wizard__pending">
      <h2>{title}</h2>
      {error ? (
        <>
          <ErrorBanner title="AI step failed" onRetry={onRetry} retrying={retrying}>
            <p>{error} Your answers are saved.</p>
          </ErrorBanner>
        </>
      ) : (
        <div className="wizard__loading">
          <ThinkingIndicator message={pendingText} />
        </div>
      )}
    </div>
  );
}
