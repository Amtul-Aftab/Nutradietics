import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { ServicesManager } from "./ServicesManager";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.PROFESSIONAL) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const professional = await prisma.professional.findUnique({
    where: { userId: session.user.id },
    include: {
      services: {
        where: { active: true },
        orderBy: { specialty: "asc" },
      },
    },
  });
  if (!professional) redirect("/signin");

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Your services</h1>
        <Link href="/professional">Back to dashboard</Link>
      </div>
      <ServicesManager
        initialServices={professional.services.map((s) => ({
          id: s.id,
          specialty: s.specialty,
          description: s.description,
          priceCents: s.priceCents,
        }))}
      />
    </main>
  );
}
