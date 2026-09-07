"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorBanner } from "@/components/ui";

interface Service {
  id: string;
  specialty: string;
  description: string;
  priceCents: number;
}
interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
}
interface Professional {
  id: string;
  name: string;
  type: "NUTRITIONIST" | "FITNESS_TRAINER";
  specialty: string;
  bio: string | null;
  services: Service[];
  slots: Slot[];
}

function typeLabel(t: Professional["type"]): string {
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
  return `${date}, ${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

export function BrowseList({
  professionals,
}: {
  professionals: Professional[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  // Track slots removed after a successful booking so they disappear locally.
  const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());

  async function book(professionalId: string, slotId: string) {
    setError(null);
    setConfirmation(null);
    setBookingSlotId(slotId);

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professionalId, timeSlotId: slotId }),
    });

    setBookingSlotId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Slot taken by someone else; prompt to pick another (Req 11.3).
        setError(
          data.error ?? "That slot was just taken. Please choose another.",
        );
        setBookedSlotIds((prev) => new Set(prev).add(slotId));
      } else {
        setError(data.error ?? "Unable to book that slot.");
      }
      router.refresh();
      return;
    }

    setBookedSlotIds((prev) => new Set(prev).add(slotId));
    setConfirmation("Appointment confirmed.");
  }

  if (professionals.length === 0) {
    return (
      <p className="slots__empty">
        No professionals are available to book right now.
      </p>
    );
  }

  return (
    <div className="browse">
      {error && (
        <ErrorBanner title="Booking issue">
          <p>{error}</p>
        </ErrorBanner>
      )}
      {confirmation && <p className="form-saved">{confirmation}</p>}

      {professionals.map((p) => {
        const slots = p.slots.filter((s) => !bookedSlotIds.has(s.id));
        return (
          <article key={p.id} className="browse__card">
            <header>
              <h2>{p.name}</h2>
              <span className="slots__badge slots__badge--available">
                {typeLabel(p.type)}
              </span>
            </header>
            <p className="browse__specialty">{p.specialty}</p>
            {p.bio && <p className="browse__bio">{p.bio}</p>}

            <h3>Services</h3>
            <ul className="browse__services">
              {p.services.map((s) => (
                <li key={s.id}>
                  <strong>{s.specialty}</strong> — ${(s.priceCents / 100).toFixed(2)}
                  <span className="services__desc"> {s.description}</span>
                </li>
              ))}
            </ul>

            <h3>Available times</h3>
            {slots.length === 0 ? (
              <p className="slots__empty">No open slots.</p>
            ) : (
              <ul className="browse__slots">
                {slots.map((s) => (
                  <li key={s.id}>
                    <span>{formatRange(s.startsAt, s.endsAt)}</span>
                    <Button
                      onClick={() => book(p.id, s.id)}
                      loading={bookingSlotId === s.id}
                    >
                      Book
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
