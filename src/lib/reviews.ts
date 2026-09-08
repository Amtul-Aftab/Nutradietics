import { prisma } from "@/lib/prisma";

export interface RatingSummary {
  average: number | null; // null when no reviews (Req 16.6)
  count: number;
}

/** Average rating + review count for a professional (Req 16.5, 16.6). */
export async function getProfessionalRating(
  professionalId: string,
): Promise<RatingSummary> {
  const agg = await prisma.review.aggregate({
    where: { professionalId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = agg._count._all;
  return {
    average: count > 0 && agg._avg.rating != null ? agg._avg.rating : null,
    count,
  };
}

/** Batch version: rating summaries for many professionals at once. */
export async function getProfessionalRatings(
  professionalIds: string[],
): Promise<Map<string, RatingSummary>> {
  const rows = await prisma.review.groupBy({
    by: ["professionalId"],
    where: { professionalId: { in: professionalIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const map = new Map<string, RatingSummary>();
  for (const id of professionalIds) map.set(id, { average: null, count: 0 });
  for (const r of rows) {
    map.set(r.professionalId, {
      average: r._avg.rating ?? null,
      count: r._count._all,
    });
  }
  return map;
}
