"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";
import { useToast } from "@/components/Toast";

type TypeChoice = "NUTRITIONIST" | "FITNESS_TRAINER";

interface ProfileFormProps {
  initial: {
    name: string;
    type: TypeChoice;
    specialty: string;
    bio: string;
  };
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState<TypeChoice>(initial.type);
  const [specialty, setSpecialty] = useState(initial.specialty);
  const [bio, setBio] = useState(initial.bio);
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

    const res = await fetch("/api/professionals/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, specialty, bio }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      setError(data.error ?? "Unable to save your profile.");
      return;
    }

    setSaved(true);
    toast("Profile updated.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <ErrorBanner title="Could not save">
          <p>{error}</p>
        </ErrorBanner>
      )}
      {saved && <p className="form-saved">Profile saved.</p>}

      <FormField label="Name" htmlFor="name" required error={fieldErrors.name}>
        <Input
          id="name"
          placeholder="e.g. Maya Ahmed"
          value={name}
          onChange={(e) => setName(e.target.value)}
          invalid={Boolean(fieldErrors.name)}
          required
        />
      </FormField>

      <FormField
        label="Professional type"
        htmlFor="type"
        required
        error={fieldErrors.type}
      >
        <select
          id="type"
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value as TypeChoice)}
        >
          <option value="NUTRITIONIST">Nutritionist</option>
          <option value="FITNESS_TRAINER">Fitness trainer</option>
        </select>
      </FormField>

      <FormField
        label="Specialty"
        htmlFor="specialty"
        required
        hint="e.g. Weight management, sports nutrition, strength training"
        error={fieldErrors.specialty}
      >
        <Input
          id="specialty"
          placeholder="e.g. Weight management, sports nutrition"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          invalid={Boolean(fieldErrors.specialty)}
          required
        />
      </FormField>

      <FormField label="Bio" htmlFor="bio" hint="Optional">
        <textarea
          id="bio"
          className="input textarea"
          rows={4}
          placeholder="Tell clients about your background, approach, and who you love working with."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </FormField>

      <Button type="submit" loading={submitting}>
        {submitting ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
