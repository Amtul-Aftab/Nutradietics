import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/auth-helpers";

/**
 * Requires a PROFESSIONAL session and returns the associated Professional
 * record. Throws AuthError(403) if the profile row is missing.
 */
export async function requireProfessional() {
  const session = await requireRole(Role.PROFESSIONAL);
  const professional = await prisma.professional.findUnique({
    where: { userId: session.user.id },
  });
  if (!professional) {
    throw new AuthError(403, "Professional profile not found.");
  }
  return { session, professional };
}
