import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SlotStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { humanizeEnum, formatRange } from "@/lib/format";
import { formatPkr } from "@/lib/currency";
import { getProfessionalRating } from "@/lib/reviews";
import { Avatar } from "@/components/Avatar";
import { RatingBadge } from "@/components/RatingBadge";

export const dynamic = "force-dynamic";

// Public professional profile (no auth required). Shows the professional's
// details, active services, and upcoming available slots. Booking routes to
// the intake flow when signed in, or to signup otherwise.

async function loadProfessional(id: string) {
  return prisma.professional.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      specialty: true,
      bio: true,
      avatarUrl: true,
      services: {
        where: { active: true },
        select: { id: true, specialty: true, description: true, priceCents: true },
        orderBy: { priceCents: "asc" },
      },
      slots: {
        where: { status: SlotStatus.AVAILABLE, startsAt: { gte: new Date() } },
        select: { id: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: "asc" },
        take: 8,
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const professional = await prisma.professional.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: professional ? professional.name : "Professional" };
}

export default async function PublicProfessionalProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const professional = await loadProfessional(id);
  if (!professional) notFound();

  const session = await auth();
  const bookHref = session?.user ? "/client/intake" : "/signup";
  const rating = await getProfessionalRating(professional.id);

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>{professional.name}</h1>
        <Link href="/">Back to home</Link>
      </div>

      <article className="browse__card">
        <header className="browse__card-header">
          <Avatar url={professional.avatarUrl} name={professional.name} size={56} />
          <div>
            <h2>{professional.name}</h2>
            <span className="slots__badge slots__badge--available">
              {humanizeEnum(professional.type)}
            </span>
          </div>
        </header>

        <p className="browse__rating">
          <RatingBadge average={rating.average} count={rating.count} />
        </p>
        {professional.specialty && (
          <p className="browse__specialty">{professional.specialty}</p>
        )}
        {professional.bio && <p className="browse__bio">{professional.bio}</p>}

        <h3>Services</h3>
        {professional.services.length === 0 ? (
          <p className="slots__empty">No services listed yet.</p>
        ) : (
          <ul className="profile-services">
            {professional.services.map((s) => (
              <li key={s.id} className="profile-services__item">
                <div className="profile-services__row">
                  <strong>{s.specialty}</strong>
                  <span className="profile-services__price">
                    {formatPkr(s.priceCents)}
                  </span>
                </div>
                {s.description && (
                  <p className="profile-services__desc">{s.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <h3>Available times</h3>
        {professional.slots.length === 0 ? (
          <p className="slots__empty">No open slots right now.</p>
        ) : (
          <ul className="browse__slots">
            {professional.slots.map((s) => (
              <li key={s.id}>
                <span>{formatRange(s.startsAt, s.endsAt)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="profile-book">
          <Link href={bookHref} className="btn btn--primary">
            Book appointment
          </Link>
          {!session?.user && (
            <p className="auth-page__hint">
              You&apos;ll create an account to book — it only takes a minute.
            </p>
          )}
        </div>
      </article>
    </main>
  );
}
