import { redirect } from "next/navigation";
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
      <p>Welcome, {session.user.email}. Your intake flow will live here.</p>
    </main>
  );
}
