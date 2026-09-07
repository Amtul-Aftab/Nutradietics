import { redirect } from "next/navigation";
import Link from "next/link";
import { IntakeStatus, Role, SlotStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathForRole } from "@/lib/routes";
import { stepForStatus } from "@/lib/intake-steps";
import { fieldSpecsForType } from "@/lib/standard-fields";
import { IntakeWizard, type WizardData } from "./IntakeWizard";

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
    include: {
      questions: { orderBy: { order: "asc" } },
      match: true,
    },
  });

  const step = stepForStatus(intake?.status ?? null);

  // Assemble the per-step data the wizard needs.
  const data: WizardData = {
    step,
    intakeId: intake?.id ?? null,
    description: intake?.description ?? null,
    professionalType: intake?.professionalType ?? null,
    fields:
      intake?.professionalType != null
        ? fieldSpecsForType(intake.professionalType)
        : [],
    standardFields:
      (intake?.standardFields as Record<string, unknown> | null) ?? null,
    questions:
      intake?.questions.map((q) => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
      })) ?? [],
    match: null,
  };

  // When matched, load the matched professional's details + available slots.
  if (intake?.match) {
    const professional = await prisma.professional.findUnique({
      where: { id: intake.match.matchedProfessionalId },
      include: {
        slots: {
          where: { status: SlotStatus.AVAILABLE, startsAt: { gt: new Date() } },
          orderBy: { startsAt: "asc" },
        },
      },
    });
    if (professional) {
      data.match = {
        professionalId: professional.id,
        name: professional.name,
        type: professional.type,
        specialty: professional.specialty,
        bio: professional.bio,
        rationale: intake.match.rationale,
        slots: professional.slots.map((s) => ({
          id: s.id,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
        })),
      };
    }
  }

  return (
    <main className="dashboard">
      <div className="dashboard__header">
        <h1>Get matched</h1>
        <Link href="/client">Back to dashboard</Link>
      </div>
      <IntakeWizard data={data} />
    </main>
  );
}
