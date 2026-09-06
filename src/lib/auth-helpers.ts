import type { Session } from "next-auth";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";

/** Error thrown by authorization helpers; carries an HTTP status. */
export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** Returns the current session or null. */
export async function getSession(): Promise<Session | null> {
  return auth();
}

/**
 * Returns the session, throwing AuthError(401) if unauthenticated.
 * For use in route handlers / server actions (Req 1.6).
 */
export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError(401, "Authentication required.");
  }
  return session;
}

/**
 * Returns the session, throwing AuthError(401) if unauthenticated or
 * AuthError(403) if the user's role is not permitted (Req 1.6).
 */
export async function requireRole(
  ...roles: Role[]
): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.user.role)) {
    throw new AuthError(403, "You do not have access to this resource.");
  }
  return session;
}
