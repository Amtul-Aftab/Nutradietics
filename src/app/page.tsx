import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find nutrition & fitness support",
};

export default function HomePage() {
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
          <Link href="/client/intake" className="btn btn--primary">
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
