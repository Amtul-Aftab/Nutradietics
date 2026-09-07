import { redirect } from "next/navigation";
import Link from "next/link";
import { IntakeStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { stepForStatus } from "@/lib/intake-steps";
import { IntakeWizard } from "./IntakeWizard";

export default async function IntakePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.CLIENT) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!clientProfile) redirect("/signin");

  // Resume the most recent intake that isn't fully booked; otherwise start new.
  const intake = await prisma.intake.findFirst({
    where: {
      clientProfileId: clientProfile.id,
      status: { not: IntakeStatus.BOOKED },
    },
    orderBy: { createdAt: "desc" },
  });

  const step = stepForStatus(intake?.status ?? null);

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Get matched</h1>
        <Link href="/client">Back to dashboard</Link>
      </div>
      <IntakeWizard step={step} description={intake?.description ?? null} />
    </main>
  );
}
