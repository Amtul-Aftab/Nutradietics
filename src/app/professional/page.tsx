import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { dashboardPathForRole } from "@/lib/routes";

export default async function ProfessionalDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.PROFESSIONAL) {
    redirect(dashboardPathForRole(session.user.role));
  }

  return (
    <main className="dashboard">
      <h1>Professional dashboard</h1>
      <p>Welcome, {session.user.email}.</p>
      <p>Professional type: {session.user.professionalType ?? "—"}</p>
      <nav className="dashboard__links">
        <Link href="/professional/profile">Edit profile</Link>
        <Link href="/professional/services">Manage services</Link>
        <Link href="/professional/availability">Manage availability</Link>
        <Link href="/professional/schedule">View schedule</Link>
      </nav>
    </main>
  );
}
