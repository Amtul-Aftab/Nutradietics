import {
  AppointmentStatus,
  IntakeStatus,
  Prisma,
  SlotStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 404 — slot not found. */
export class SlotNotFoundError extends Error {
  constructor(message = "Time slot not found.") {
    super(message);
    this.name = "SlotNotFoundError";
  }
}

/** 409 — slot was already booked (lost the race) or not bookable. */
export class SlotUnavailableError extends Error {
  constructor(message = "That time slot is no longer available.") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

interface BookArgs {
  clientProfileId: string;
  timeSlotId: string;
  /** Optional until Phase 10 wires booking to the AI intake flow. */
  intakeId?: string | null;
}

/**
 * Books a time slot atomically (Req 4.4, 11.2, 11.3).
 *
 * The conditional `updateMany({ where: { id, status: AVAILABLE } })` is the
 * concurrency guard: only one concurrent caller can flip AVAILABLE -> BOOKED,
 * so the one whose update affects 0 rows loses and gets a 409.
 */
export async function bookSlot({
  clientProfileId,
  timeSlotId,
  intakeId = null,
}: BookArgs) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const slot = await tx.timeSlot.findUnique({
          where: { id: timeSlotId },
        });
        if (!slot) {
          throw new SlotNotFoundError();
        }
        if (slot.status !== SlotStatus.AVAILABLE) {
          throw new SlotUnavailableError();
        }

        // Conditional claim: succeeds for exactly one concurrent booking.
        const claimed = await tx.timeSlot.updateMany({
          where: { id: timeSlotId, status: SlotStatus.AVAILABLE },
          data: { status: SlotStatus.BOOKED },
        });
        if (claimed.count === 0) {
          throw new SlotUnavailableError();
        }

        const appointment = await tx.appointment.create({
          data: {
            clientProfileId,
            professionalId: slot.professionalId,
            timeSlotId,
            intakeId: intakeId ?? null,
            status: AppointmentStatus.CONFIRMED,
          },
        });

        // Keep the intake in sync when this booking came from the intake flow.
        if (intakeId) {
          await tx.intake.update({
            where: { id: intakeId },
            data: { status: IntakeStatus.BOOKED },
          });
        }

        return appointment;
      },
      {
        // Remote Supabase latency: give the transaction room beyond defaults.
        maxWait: 15000,
        timeout: 15000,
      },
    );
  } catch (error) {
    // A unique-constraint hit on timeSlotId means another booking won the race.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new SlotUnavailableError();
    }
    throw error;
  }
}
