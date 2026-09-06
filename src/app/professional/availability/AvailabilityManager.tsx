"use client";

import { useState, type FormEvent } from "react";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";

interface Slot {
  id: string;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  status: "AVAILABLE" | "BOOKED" | "REMOVED";
}

interface AvailabilityManagerProps {
  initialSlots: Slot[];
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
  return `${date}, ${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

export function AvailabilityManager({
  initialSlots,
}: AvailabilityManagerProps) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const res = await fetch("/api/professionals/me/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // datetime-local values are local wall-clock; convert to ISO with tz.
      body: JSON.stringify({
        startsAt: startsAt ? new Date(startsAt).toISOString() : "",
        endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      setError(data.error ?? "Unable to add the slot.");
      return;
    }

    const data = await res.json();
    const created: Slot = data.slot;
    setSlots((prev) =>
      [...prev, created].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    );
    setStartsAt("");
    setEndsAt("");
  }

  async function onRemove(id: string) {
    setError(null);
    const res = await fetch(`/api/professionals/me/slots/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to remove the slot.");
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="slots">
      <section className="slots__list">
        <h2>Your availability</h2>
        {slots.length === 0 ? (
          <p className="slots__empty">No slots yet. Add one below.</p>
        ) : (
          <ul>
            {slots.map((s) => (
              <li key={s.id} className="slots__item">
                <div>
                  <span>{formatRange(s.startsAt, s.endsAt)}</span>
                  <span
                    className={`slots__badge slots__badge--${s.status.toLowerCase()}`}
                  >
                    {s.status === "BOOKED" ? "Booked" : "Available"}
                  </span>
                </div>
                <Button
                  variant="danger"
                  onClick={() => onRemove(s.id)}
                  disabled={s.status === "BOOKED"}
                  title={
                    s.status === "BOOKED"
                      ? "Booked slots cannot be removed"
                      : undefined
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="slots__form">
        <h2>Add a slot</h2>
        <form onSubmit={onAdd} noValidate>
          {error && (
            <ErrorBanner title="Could not add slot">
              <p>{error}</p>
            </ErrorBanner>
          )}
          <FormField
            label="Start"
            htmlFor="slot-start"
            required
            error={fieldErrors.startsAt}
          >
            <Input
              id="slot-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              invalid={Boolean(fieldErrors.startsAt)}
              required
            />
          </FormField>
          <FormField
            label="End"
            htmlFor="slot-end"
            required
            error={fieldErrors.endsAt}
          >
            <Input
              id="slot-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              invalid={Boolean(fieldErrors.endsAt)}
              required
            />
          </FormField>
          <Button type="submit" loading={submitting}>
            Add slot
          </Button>
        </form>
      </section>
    </div>
  );
}
