import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
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
    select: { type: true },
  });

  return (
    <main className="dashboard">
      <h1>Professional dashboard</h1>
      <p>Welcome, {session.user.email}.</p>
      <p>Professional type: {professional?.type ?? "—"}</p>
      <nav className="dashboard__links">
        <Link href="/professional/profile">Edit profile</Link>
        <Link href="/professional/services">Manage services</Link>
        <Link href="/professional/availability">Manage availability</Link>
        <Link href="/professional/schedule">View schedule</Link>
      </nav>
    </main>
  );
}
