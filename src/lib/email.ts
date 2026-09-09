import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Email verification helpers (Req 17). Sending is best-effort: a failure here
// must never block signup. Uses the Resend HTTP API directly (no SDK) so the
// dependency surface stays small.
// ---------------------------------------------------------------------------

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** From-address for outbound email. Resend's shared sandbox sender works
 * without domain setup; override with a verified domain in production. */
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "noreply@resend.dev";

/** Generate a URL-safe 32-character verification token. */
export function generateVerificationToken(): string {
  // 24 random bytes -> 32 base64url chars (no padding). Cryptographically random.
  return randomBytes(24).toString("base64url").slice(0, 32);
}

/** Absolute base URL for building app links, from env with a dev default. */
export function appBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  return raw.replace(/\/+$/, ""); // strip trailing slashes
}

export function verificationUrl(token: string): string {
  return `${appBaseUrl()}/api/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Low-level Resend send. Best-effort: returns true on success, false on any
 * failure (missing key, network error, non-2xx). Never throws, so callers can
 * safely ignore the result. Shared by verification + booking emails.
 */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set; skipping send.");
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: args.to,
        subject: args.subject,
        html: args.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[email] Resend send failed (${res.status}): ${detail.slice(0, 500)}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Resend send threw:", error);
    return false;
  }
}

/**
 * Send the verification email via Resend. Best-effort (see sendEmail): never
 * throws, so callers can proceed with signup regardless of the result.
 */
export async function sendVerificationEmail(
  toEmail: string,
  token: string,
): Promise<boolean> {
  const link = verificationUrl(token);
  const html = `<p>Click to verify: <a href="${link}">Verify email</a></p><p>Link expires in 24 hours.</p>`;
  return sendEmail({
    to: toEmail,
    subject: "Verify your Nutradietics email",
    html,
  });
}
