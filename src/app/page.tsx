import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { humanizeEnum } from "@/lib/format";
import { formatPkr } from "@/lib/currency";
import { Avatar } from "@/components/Avatar";

export const metadata: Metadata = {
  title: "Find nutrition & fitness support",
};

// Public landing page. Reads fresh so featured professionals reflect the
// current roster; no auth required.
export const dynamic = "force-dynamic";

/** Pick up to `n` random items from a list (Fisher-Yates partial shuffle). */
function pickRandom<T>(items: T[], n: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export default async function HomePage() {
  const session = await auth();
  const getStartedHref = session?.user ? "/client/intake" : "/signup";

  // Feature a handful of professionals who have at least one active service
  // (so we can show a real starting price). Random selection each load.
  const candidates = await prisma.professional.findMany({
    where: { services: { some: { active: true } } },
    select: {
      id: true,
      name: true,
      type: true,
      specialty: true,
      avatarUrl: true,
      services: {
        where: { active: true },
        select: { priceCents: true },
        orderBy: { priceCents: "asc" },
        take: 1,
      },
    },
  });
  const featured = pickRandom(candidates, 5);

  return (
    <div className="home">
      <section className="hero">
        <div>
          <span className="hero__pill">● Wellbeing support, made personal</span>
          <h1>Find the right support for your health goals</h1>
          <p>
            Nutradietics uses AI-assisted matching to connect you with
            nutrition and fitness professionals who fit your goals, schedule,
            and needs.
          </p>
          <Link href={getStartedHref} className="btn btn--primary">
            Get started
          </Link>
          <div className="hero__trust">
            <span className="hero__tag">AI-guided matching</span>
            <span className="hero__tag">Privacy-conscious by design</span>
          </div>
        </div>
        <div className="hero__card">
          <p className="hero__card-label">HOW IT WORKS</p>
          <div className="hero__step">
            <span className="hero__num">1</span>
            <div>
              <strong>Describe your goal</strong>
              <p>Tell us what support would help right now.</p>
            </div>
          </div>
          <div className="hero__step">
            <span className="hero__num">2</span>
            <div>
              <strong>Get matched</strong>
              <p>AI connects you with the right professional.</p>
            </div>
          </div>
          <div className="hero__step">
            <span className="hero__num">3</span>
            <div>
              <strong>Book your session</strong>
              <p>Pick a time that works for you.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="why">
        <p className="why__eyebrow">Why Nutradietics</p>
        <h2 className="why__title">Support that actually fits you</h2>
        <div className="why__grid">
          <article className="why__card">
            <span className="why__icon" aria-hidden="true">
              🎯
            </span>
            <h3>Matched to your goals</h3>
            <p>
              Instead of scrolling endless listings, tell us what you need and
              get pointed to the right kind of professional.
            </p>
          </article>
          <article className="why__card">
            <span className="why__icon" aria-hidden="true">
              🤝
            </span>
            <h3>Real professionals</h3>
            <p>
              Connect with nutritionists and fitness trainers who set their own
              services, pricing, and availability.
            </p>
          </article>
          <article className="why__card">
            <span className="why__icon" aria-hidden="true">
              🔒
            </span>
            <h3>Privacy-conscious</h3>
            <p>
              Your intake and history stay with you and the professionals you
              choose to work with — nothing more.
            </p>
          </article>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="featured">
          <p className="why__eyebrow">Featured professionals</p>
          <h2 className="why__title">Meet a few of our professionals</h2>
          <div className="featured__grid">
            {featured.map((p) => {
              const startingPrice = p.services[0]?.priceCents ?? null;
              return (
                <article key={p.id} className="featured__card">
                  <div className="featured__head">
                    <Avatar url={p.avatarUrl} name={p.name} size={52} />
                    <div className="featured__meta">
                      <strong>{p.name}</strong>
                      <span className="featured__type">
                        {humanizeEnum(p.type)}
                      </span>
                    </div>
                  </div>
                  {p.specialty && (
                    <p className="featured__specialty">{p.specialty}</p>
                  )}
                  {startingPrice != null && (
                    <p className="featured__price">
                      From {formatPkr(startingPrice)}
                    </p>
                  )}
                  <Link
                    href={`/professionals/${p.id}`}
                    className="featured__link"
                  >
                    View profile
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="cta-footer">
        <h2>Ready to get started?</h2>
        <p>Find your perfect match today</p>
        <Link href={getStartedHref} className="btn btn--primary">
          Get started
        </Link>
      </section>

      <footer className="site-footer">
        <p className="site-footer__brand">Nutradietics</p>
        <p>Connecting people with nutrition and fitness support.</p>
        <p className="site-footer__fine">
          For wellbeing support only — not a substitute for professional medical
          advice.
        </p>
      </footer>
    </div>
  );
}
