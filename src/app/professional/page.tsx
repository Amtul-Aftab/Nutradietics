import { redirect } from "next/navigation";
import Link from "next/link";
import { Role, SlotStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";

// Always read fresh from the DB so profile edits (e.g. professional type)
// reflect immediately, rather than showing the stale value baked into the JWT.
export const dynamic = "force-dynamic";

export default async function ProfessionalDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.PROFESSIONAL) {
    redirect(dashboardPathForRole(session.user.role));
  }

  // Source of truth is the database, not the session token.
  const professional = await prisma.professional.findUnique({
    where: { userId: session.user.id },
    select: {
      type: true,
      _count: {
        select: {
          services: { where: { active: true } },
          slots: { where: { status: SlotStatus.AVAILABLE } },
        },
      },
    },
  });

  const serviceCount = professional?._count.services ?? 0;
  const slotCount = professional?._count.slots ?? 0;
  const needsSetup = serviceCount === 0 || slotCount === 0;

  return (
    <main className="dashboard">
      <p className="dashboard__eyebrow">Professional workspace</p>
      <h1>Your workspace</h1>
      <p className="dashboard__welcome">
        Signed in as {session.user.email} · {professional?.type ?? "—"}
      </p>

      <nav className="dashboard__links">
        <Link href="/professional/profile">Edit profile</Link>
        <Link href="/professional/services">Manage services</Link>
        <Link href="/professional/availability">Manage availability</Link>
        <Link href="/professional/schedule">View schedule</Link>
      </nav>

      {needsSetup && (
        <section className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            ✨
          </span>
          <h2>Finish setting up your profile</h2>
          <p>
            Clients can only be matched with you once you&apos;re bookable.
            A couple of quick steps to go:
          </p>
          <ul className="setup-checklist">
            <li className={serviceCount > 0 ? "is-done" : ""}>
              {serviceCount > 0 ? "✓" : "○"} Add at least one service
              {serviceCount === 0 && (
                <>
                  {" — "}
                  <Link href="/professional/services">add a service</Link>
                </>
              )}
            </li>
            <li className={slotCount > 0 ? "is-done" : ""}>
              {slotCount > 0 ? "✓" : "○"} Publish an available time slot
              {slotCount === 0 && (
                <>
                  {" — "}
                  <Link href="/professional/availability">add availability</Link>
                </>
              )}
            </li>
          </ul>
        </section>
      )}
    </main>
  );
}
