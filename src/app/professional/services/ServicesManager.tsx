"use client";

import { useState, type FormEvent } from "react";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";

interface Service {
  id: string;
  specialty: string;
  description: string;
  priceCents: number;
}

interface ServicesManagerProps {
  initialServices: Service[];
}

function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(parseFloat(trimmed) * 100);
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ServicesManager({ initialServices }: ServicesManagerProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state (shared for create + edit)
  const [specialty, setSpecialty] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setEditingId(null);
    setSpecialty("");
    setDescription("");
    setPrice("");
    setFieldErrors({});
    setError(null);
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setSpecialty(s.specialty);
    setDescription(s.description);
    setPrice(centsToDollars(s.priceCents));
    setFieldErrors({});
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const priceCents = dollarsToCents(price);
    if (priceCents === null) {
      setFieldErrors({ priceCents: "Enter a valid price like 49 or 49.99." });
      return;
    }

    setSubmitting(true);
    const url = editingId
      ? `/api/professionals/me/services/${editingId}`
      : "/api/professionals/me/services";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ specialty, description, priceCents, active: true }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      setError(data.error ?? "Unable to save the service.");
      return;
    }

    const data = await res.json();
    const saved: Service = data.service;
    setServices((prev) =>
      editingId
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [...prev, saved],
    );
    resetForm();
  }

  async function onDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/professionals/me/services/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to remove the service.");
      return;
    }
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) resetForm();
  }

  return (
    <div className="services">
      <section className="services__list">
        <h2>Your services</h2>
        {services.length === 0 ? (
          <p className="services__empty">No services yet. Add one below.</p>
        ) : (
          <ul>
            {services.map((s) => (
              <li key={s.id} className="services__item">
                <div>
                  <strong>{s.specialty}</strong> — ${centsToDollars(s.priceCents)}
                  <p className="services__desc">{s.description}</p>
                </div>
                <div className="services__actions">
                  <Button variant="secondary" onClick={() => startEdit(s)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(s.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="services__form">
        <h2>{editingId ? "Edit service" : "Add a service"}</h2>
        <form onSubmit={onSubmit} noValidate>
          {error && (
            <ErrorBanner title="Could not save">
              <p>{error}</p>
            </ErrorBanner>
          )}
          <FormField
            label="Specialty"
            htmlFor="svc-specialty"
            required
            error={fieldErrors.specialty}
          >
            <Input
              id="svc-specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              invalid={Boolean(fieldErrors.specialty)}
              required
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="svc-description"
            required
            error={fieldErrors.description}
          >
            <textarea
              id="svc-description"
              className="input textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <FormField
            label="Price (USD)"
            htmlFor="svc-price"
            required
            hint="Per session, e.g. 49.99"
            error={fieldErrors.priceCents}
          >
            <Input
              id="svc-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              invalid={Boolean(fieldErrors.priceCents)}
              required
            />
          </FormField>
          <div className="services__form-actions">
            <Button type="submit" loading={submitting}>
              {editingId ? "Save changes" : "Add service"}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
