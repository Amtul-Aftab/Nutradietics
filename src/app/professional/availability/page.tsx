import { redirect } from "next/navigation";
import Link from "next/link";
import { Role, SlotStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { AvailabilityManager } from "./AvailabilityManager";

export default async function AvailabilityPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.PROFESSIONAL) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const professional = await prisma.professional.findUnique({
    where: { userId: session.user.id },
    include: {
      slots: {
        where: { status: { not: SlotStatus.REMOVED } },
        orderBy: { startsAt: "asc" },
      },
    },
  });
  if (!professional) redirect("/signin");

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Your availability</h1>
        <Link href="/professional">Back to dashboard</Link>
      </div>
      <AvailabilityManager
        initialSlots={professional.slots.map((s) => ({
          id: s.id,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          status: s.status,
        }))}
      />
    </main>
  );
}
