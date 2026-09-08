"use client";

import { useState, type FormEvent } from "react";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { formatRange } from "@/lib/format";

interface Slot {
  id: string;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  status: "AVAILABLE" | "BOOKED" | "REMOVED";
}

interface AvailabilityManagerProps {
  initialSlots: Slot[];
}

export function AvailabilityManager({
  initialSlots,
}: AvailabilityManagerProps) {
  const { toast } = useToast();
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
    toast("Time slot added.");
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
    toast("Time slot removed.");
  }

  return (
    <div className="slots">
      <section className="slots__list">
        <h2>Your availability</h2>
        {slots.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">
              🗓️
            </span>
            <h2>Set your availability</h2>
            <p>
              Add a few open time slots so matched clients can actually book a
              session with you.
            </p>
            <a href="#slot-form" className="btn btn--primary">
              Add a time slot
            </a>
          </div>
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

      <section className="slots__form" id="slot-form">
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
            {submitting ? "Adding..." : "Add slot"}
          </Button>
        </form>
      </section>
    </div>
  );
}
