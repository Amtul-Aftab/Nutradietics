import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== Role.PROFESSIONAL) {
    redirect(dashboardPathForRole(session.user.role));
  }

  const professional = await prisma.professional.findUnique({
    where: { userId: session.user.id },
  });
  if (!professional) redirect("/signin");

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Your profile</h1>
        <Link href="/professional">Back to dashboard</Link>
      </div>
      <ProfileForm
        initial={{
          name: professional.name,
          type: professional.type,
          specialty: professional.specialty,
          bio: professional.bio ?? "",
        }}
      />
    </main>
  );
}
