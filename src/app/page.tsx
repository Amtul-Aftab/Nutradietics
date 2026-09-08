import Link from "next/link";

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
    </div>
  );
}
