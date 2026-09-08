"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorBanner } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface ReviewFormProps {
  appointmentId: string;
  initial: { rating: number; text: string } | null;
}

export function ReviewForm({ appointmentId, initial }: ReviewFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [text, setText] = useState(initial?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (rating < 1 || rating > 5) {
      setError("Please choose a rating from 1 to 5 stars.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/appointments/${appointmentId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, text }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Unable to submit your review.");
      return;
    }
    setSaved(true);
    toast(initial ? "Review updated." : "Review submitted.");
    router.refresh();
  }

  return (
    <form className="review-form" onSubmit={onSubmit} noValidate>
      {error && (
        <ErrorBanner title="Could not submit">
          <p>{error}</p>
        </ErrorBanner>
      )}
      {saved && <p className="form-saved">Thanks for your review.</p>}
      <div
        className="review-form__stars"
        role="radiogroup"
        aria-label="Rating"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={
              n <= rating ? "review-star review-star--on" : "review-star"
            }
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={n <= rating}
            onClick={() => setRating(n)}
          >
            {n <= rating ? "\u2605" : "\u2606"}
          </button>
        ))}
      </div>
      <textarea
        className="input textarea"
        rows={2}
        placeholder="Optional: a few words about your experience"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" loading={submitting}>
        {submitting
          ? "Saving..."
          : initial
            ? "Update review"
            : "Submit review"}
      </Button>
    </form>
  );
}
