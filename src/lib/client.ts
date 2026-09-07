import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/auth-helpers";

/**
 * Requires a CLIENT session and returns the associated ClientProfile record.
 * Throws AuthError(403) if the profile row is missing.
 */
export async function requireClient() {
  const session = await requireRole(Role.CLIENT);
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!clientProfile) {
    throw new AuthError(403, "Client profile not found.");
  }
  return { session, clientProfile };
}
