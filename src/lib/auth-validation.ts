import { Role, ProfessionalType } from "@prisma/client";

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignupInput {
  email: string;
  password: string;
  role: Role;
  professionalType?: ProfessionalType | null;
  name?: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates and normalizes raw signup payload. Enforces that a professional
 * signup includes exactly one of the two professional types (Req 1.2).
 */
export function validateSignup(raw: unknown): ValidationResult<SignupInput> {
  const errors: Record<string, string> = {};
  const body = (raw ?? {}) as Record<string, unknown>;

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  const roleRaw = typeof body.role === "string" ? body.role : "";
  const role = (Object.values(Role) as string[]).includes(roleRaw)
    ? (roleRaw as Role)
    : undefined;
  if (!role) {
    errors.role = "Select a valid role.";
  }

  let professionalType: ProfessionalType | null = null;
  if (role === Role.PROFESSIONAL) {
    const ptRaw =
      typeof body.professionalType === "string" ? body.professionalType : "";
    if ((Object.values(ProfessionalType) as string[]).includes(ptRaw)) {
      professionalType = ptRaw as ProfessionalType;
    } else {
      errors.professionalType = "Select a professional type.";
    }
  }

  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : undefined;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { email, password, role: role as Role, professionalType, name },
  };
}
