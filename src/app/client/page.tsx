import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { dashboardPathForRole } from "@/lib/routes";

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.CLIENT) {
    redirect(dashboardPathForRole(session.user.role));
  }

  return (
    <main className="dashboard">
      <p className="dashboard__eyebrow">Your wellbeing space</p>
      <h1>Welcome back</h1>
      <p className="dashboard__welcome">Signed in as {session.user.email}.</p>

      <nav className="dashboard__links">
        <Link href="/client/intake">Get matched</Link>
        <Link href="/client/appointments">Your appointments</Link>
        <Link href="/client/history">Medical history</Link>
      </nav>

      <section className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">
          🌱
        </span>
        <h2>Ready when you are</h2>
        <p>
          Tell us what you&apos;d like help with and we&apos;ll match you with a
          nutritionist or fitness trainer who fits your goals. Your upcoming
          sessions will show up under <strong>Your appointments</strong>.
        </p>
        <Link href="/client/intake" className="btn btn--primary">
          Find a professional
        </Link>
      </section>

      <p className="dashboard__note">
        Everything you share — your intake, AI summaries, and professional notes
        — is saved to your medical history and carried forward to future
        appointments for continuity of care.
      </p>
    </main>
  );
}
