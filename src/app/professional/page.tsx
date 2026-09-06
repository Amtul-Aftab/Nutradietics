import { redirect } from "next/navigation";
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
      <p>
        Welcome, {session.user.email}. Your profile, services, and schedule will
        live here.
      </p>
      <p>Professional type: {session.user.professionalType ?? "—"}</p>
    </main>
  );
}
