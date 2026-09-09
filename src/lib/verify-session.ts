import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Short-lived, signed "verification session" cookie (_verifySessionId).
// Set at signup so the unauthenticated /verify-email-pending page and the
// check-verification endpoint can identify *only* the just-signed-up user,
// without putting the email in the URL or allowing account enumeration.
//
// The cookie value is `<userId>.<hmac>` signed with AUTH_SECRET. It is
// HttpOnly (JS can't read it) and expires in 24h. We only ever look up the
// user id it contains, and callers return a generic result when it's absent
// or invalid.
// ---------------------------------------------------------------------------

export const VERIFY_COOKIE = "_verifySessionId";
const MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error("AUTH_SECRET is required to sign the verification cookie.");
  }
  return s;
}

function sign(userId: string): string {
  return createHmac("sha256", secret()).update(userId).digest("base64url");
}

/** Build the signed cookie value for a user id. */
export function makeVerifyCookieValue(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** Verify a cookie value and return the user id it carries, or null. */
export function readVerifyCookieValue(value: string | undefined): string | null {
  if (!value) return null;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = value.slice(0, idx);
  const providedSig = value.slice(idx + 1);
  const expectedSig = sign(userId);

  // Constant-time compare; guard against length mismatch throwing.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return userId;
}

/** Options used for both setting and clearing the cookie (must match). */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/** Set the signed verification-session cookie (server context only). */
export async function setVerifyCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(VERIFY_COOKIE, makeVerifyCookieValue(userId), {
    ...cookieOptions(),
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Read + verify the cookie from the current request; returns user id or null. */
export async function getVerifyCookieUserId(): Promise<string | null> {
  const store = await cookies();
  return readVerifyCookieValue(store.get(VERIFY_COOKIE)?.value);
}

/** Clear the verification-session cookie. */
export async function clearVerifyCookie(): Promise<void> {
  const store = await cookies();
  store.set(VERIFY_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}
