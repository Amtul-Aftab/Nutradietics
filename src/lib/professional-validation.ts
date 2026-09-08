import { ProfessionalType } from "@prisma/client";
import type { ValidationResult } from "./auth-validation";

export interface ProfileInput {
  name: string;
  type: ProfessionalType;
  specialty: string;
  bio: string | null;
}

/** Validates the professional profile payload (Req 2.1–2.4). */
export function validateProfile(raw: unknown): ValidationResult<ProfileInput> {
  const errors: Record<string, string> = {};
  const body = (raw ?? {}) as Record<string, unknown>;

  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : "";
  if (!name) errors.name = "Name is required.";

  const typeRaw = typeof body.type === "string" ? body.type : "";
  const type = (Object.values(ProfessionalType) as string[]).includes(typeRaw)
    ? (typeRaw as ProfessionalType)
    : undefined;
  if (!type) errors.type = "Select a valid professional type.";

  const specialty =
    typeof body.specialty === "string" && body.specialty.trim().length > 0
      ? body.specialty.trim()
      : "";
  if (!specialty) errors.specialty = "Specialty is required.";

  const bio =
    typeof body.bio === "string" && body.bio.trim().length > 0
      ? body.bio.trim()
      : null;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, type: type as ProfessionalType, specialty, bio } };
}

export interface ServiceInput {
  specialty: string;
  description: string;
  priceCents: number;
  active: boolean;
}

/**
 * Validates a service payload. Price is a non-negative integer number of whole
 * PKR (stored in the legacy-named `priceCents` column) (Req 3.3). Type is
 * denormalized from the professional server-side, not accepted from the client.
 */
export function validateService(raw: unknown): ValidationResult<ServiceInput> {
  const errors: Record<string, string> = {};
  const body = (raw ?? {}) as Record<string, unknown>;

  const specialty =
    typeof body.specialty === "string" && body.specialty.trim().length > 0
      ? body.specialty.trim()
      : "";
  if (!specialty) errors.specialty = "Specialty is required.";

  const description =
    typeof body.description === "string" && body.description.trim().length > 0
      ? body.description.trim()
      : "";
  if (!description) errors.description = "Description is required.";

  const priceCents = body.priceCents;
  const validPrice =
    typeof priceCents === "number" &&
    Number.isInteger(priceCents) &&
    priceCents >= 0;
  if (!validPrice) {
    errors.priceCents = "Price must be a whole, non-negative amount.";
  }

  const active = typeof body.active === "boolean" ? body.active : true;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      specialty,
      description,
      priceCents: priceCents as number,
      active,
    },
  };
}
