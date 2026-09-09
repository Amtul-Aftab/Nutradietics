import { redirect } from "next/navigation";
import Link from "next/link";
import { Role, SlotStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { getProfessionalRating } from "@/lib/reviews";
import { humanizeEnum } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { RatingBadge } from "@/components/RatingBadge";
import { ProfessionalDashboardStats } from "@/components/ProfessionalDashboardStats";
import { UpcomingAppointments } from "@/components/UpcomingAppointments";

// Always read fresh from the DB so profile edits (e.g. professional type)
// reflect immediately, rather than showing the stale value baked into the JWT.
export const dynamic = "force-dynamic";
export const metadata = { title: "Your workspace" };

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
      id: true,
      name: true,
      type: true,
      specialty: true,
      avatarUrl: true,
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

  const rating = professional
    ? await getProfessionalRating(professional.id)
    : { average: null, count: 0 };

  const displayName = professional?.name?.trim() || "there";

  return (
    <main className="dashboard">
      <p className="dashboard__eyebrow">Professional workspace</p>
      <h1>Welcome back, {displayName}</h1>

      {/* New additive widgets (placed above existing content). */}
      {professional && (
        <>
          <ProfessionalDashboardStats professionalId={professional.id} />
          <UpcomingAppointments
            professionalId={professional.id}
            professionalType={professional.type}
          />
        </>
      )}

      {professional && (
        <section className="profile-snippet">
          <Avatar
            url={professional.avatarUrl}
            name={professional.name}
            size={56}
          />
          <div className="profile-snippet__meta">
            <strong>{professional.name}</strong>
            <span className="profile-snippet__type">
              {humanizeEnum(professional.type)}
              {professional.specialty ? ` · ${professional.specialty}` : ""}
            </span>
            <RatingBadge average={rating.average} count={rating.count} />
          </div>
          <Link href="/professional/profile" className="profile-snippet__edit">
            Edit profile
          </Link>
        </section>
      )}

      <nav className="dashboard__links">
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
