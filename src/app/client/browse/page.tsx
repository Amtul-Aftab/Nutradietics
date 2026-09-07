import { redirect } from "next/navigation";
import Link from "next/link";
import { Role, SlotStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { BrowseList } from "./BrowseList";

export default async function BrowsePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.CLIENT) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const now = new Date();

  // Professionals with at least one active service AND at least one available,
  // future slot. This mirrors the Phase 9 matching candidate filter, applied
  // here as a temporary manual browse (replaced by AI match view in Phase 10).
  const professionals = await prisma.professional.findMany({
    where: {
      services: { some: { active: true } },
      slots: { some: { status: SlotStatus.AVAILABLE, startsAt: { gt: now } } },
    },
    include: {
      services: { where: { active: true }, orderBy: { specialty: "asc" } },
      slots: {
        where: { status: SlotStatus.AVAILABLE, startsAt: { gt: now } },
        orderBy: { startsAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = professionals.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    specialty: p.specialty,
    bio: p.bio,
    services: p.services.map((s) => ({
      id: s.id,
      specialty: s.specialty,
      description: s.description,
      priceCents: s.priceCents,
    })),
    slots: p.slots.map((s) => ({
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
    })),
  }));

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Find a professional</h1>
        <Link href="/client">Back to dashboard</Link>
      </div>
      <p className="browse__note">
        Temporary browse view. This will be replaced by AI-matched results.
      </p>
      <BrowseList professionals={data} />
    </main>
  );
}
