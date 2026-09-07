import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { getMedicalHistory } from "@/lib/medical-history";
import { MedicalHistoryTimeline } from "@/components/MedicalHistoryTimeline";

export default async function ClientHistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.CLIENT) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!clientProfile) redirect("/signin");

  const history = await getMedicalHistory(clientProfile.id);

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Your medical history</h1>
        <Link href="/client">Back to dashboard</Link>
      </div>
      <MedicalHistoryTimeline entries={history} />
    </main>
  );
}
