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
      <h1>Client dashboard</h1>
      <p>Welcome, {session.user.email}.</p>
      <nav className="dashboard__links">
        <Link href="/client/intake">Get matched</Link>
        <Link href="/client/history">Medical history</Link>
      </nav>
    </main>
  );
}
