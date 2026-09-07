import { ProfessionalType, SlotStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toMatchCandidates } from "@/lib/ai/minimize";
import type { MatchCandidate } from "@/lib/ai/types";

/**
 * Returns the minimal match candidates for a professional type (Req 9.2, 9.3):
 * professionals of that type with at least one active service AND at least one
 * available future slot. Returns [] when none qualify (caller short-circuits
 * to "no match" without calling the AI, Req 9.5).
 */
export async function getMatchCandidates(
  type: ProfessionalType,
): Promise<MatchCandidate[]> {
  const now = new Date();
  const professionals = await prisma.professional.findMany({
    where: {
      type,
      services: { some: { active: true } },
      slots: { some: { status: SlotStatus.AVAILABLE, startsAt: { gt: now } } },
    },
    include: {
      services: { where: { active: true }, select: { description: true } },
    },
  });

  return toMatchCandidates(professionals);
}
