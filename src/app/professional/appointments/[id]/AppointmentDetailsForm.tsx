"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";

interface AppointmentDetailsFormProps {
  appointmentId: string;
  initialMeetingLink: string;
  initialPaymentStatus: "PENDING" | "PAID";
}

/**
 * Professional-only controls (Req 11.6, 11.7): set the video meeting link and
 * toggle payment status (payment is arranged off-platform).
 */
export function AppointmentDetailsForm({
  appointmentId,
  initialMeetingLink,
  initialPaymentStatus,
}: AppointmentDetailsFormProps) {
  const router = useRouter();
  const [meetingLink, setMeetingLink] = useState(initialMeetingLink);
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [togglingPaid, setTogglingPaid] = useState(false);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Unable to update the appointment.");
      return false;
    }
    return true;
  }

  async function saveLink(e: FormEvent) {
    e.preventDefault();
    setSavingLink(true);
    const ok = await patch({ meetingLink });
    setSavingLink(false);
    if (ok) {
      setSaved(true);
      router.refresh();
    }
  }

  async function togglePaid() {
    const next = paymentStatus === "PAID" ? "PENDING" : "PAID";
    setTogglingPaid(true);
    const ok = await patch({ paymentStatus: next });
    setTogglingPaid(false);
    if (ok) {
      setPaymentStatus(next);
      router.refresh();
    }
  }

  return (
    <div>
      {error && (
        <ErrorBanner title="Could not update">
          <p>{error}</p>
        </ErrorBanner>
      )}
      {saved && <p className="form-saved">Saved.</p>}

      <form onSubmit={saveLink} noValidate>
        <FormField
          label="Video call link"
          htmlFor="meeting-link"
          hint="Paste your video call URL (e.g. Google Meet, Zoom). Shared with the client."
        >
          <Input
            id="meeting-link"
            type="url"
            placeholder="https://..."
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
          />
        </FormField>
        <Button type="submit" loading={savingLink}>
          Save link
        </Button>
      </form>

      <div className="appointment__payment">
        <p>
          <strong>Payment:</strong>{" "}
          <span
            className={`slots__badge slots__badge--${paymentStatus === "PAID" ? "confirmed" : "booked"}`}
          >
            {paymentStatus === "PAID" ? "Paid" : "Pending"}
          </span>
        </p>
        <Button
          variant={paymentStatus === "PAID" ? "secondary" : "primary"}
          onClick={togglePaid}
          loading={togglingPaid}
        >
          {paymentStatus === "PAID" ? "Mark as pending" : "Mark as paid"}
        </Button>
      </div>
    </div>
  );
}
