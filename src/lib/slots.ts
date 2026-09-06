import { SlotStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 400 — invalid slot input (bad range or past start). */
export class SlotValidationError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super("Slot validation failed.");
    this.name = "SlotValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** 409 — the requested slot overlaps an existing non-removed slot. */
export class SlotConflictError extends Error {
  constructor(message = "This time slot overlaps an existing slot.") {
    super(message);
    this.name = "SlotConflictError";
  }
}

/** 409 — attempt to remove a slot that is already booked. */
export class SlotBookedError extends Error {
  constructor(message = "A booked slot cannot be removed.") {
    super(message);
    this.name = "SlotBookedError";
  }
}

/** 404 — slot not found or not owned by the professional. */
export class SlotNotFoundError extends Error {
  constructor(message = "Slot not found.") {
    super(message);
    this.name = "SlotNotFoundError";
  }
}

interface CreateSlotArgs {
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Creates an available time slot after validating the range and checking for
 * overlaps against the professional's existing non-removed slots (Req 4.1–4.3).
 *
 * Two ranges overlap when: newStart < existingEnd AND newEnd > existingStart.
 */
export async function createSlot({
  professionalId,
  startsAt,
  endsAt,
}: CreateSlotArgs) {
  const fieldErrors: Record<string, string> = {};

  if (Number.isNaN(startsAt.getTime())) {
    fieldErrors.startsAt = "Enter a valid start time.";
  }
  if (Number.isNaN(endsAt.getTime())) {
    fieldErrors.endsAt = "Enter a valid end time.";
  }
  if (Object.keys(fieldErrors).length === 0) {
    if (endsAt <= startsAt) {
      fieldErrors.endsAt = "End time must be after the start time.";
    }
    if (startsAt.getTime() <= Date.now()) {
      fieldErrors.startsAt = "Start time must be in the future.";
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new SlotValidationError(fieldErrors);
  }

  const existing = await prisma.timeSlot.findMany({
    where: {
      professionalId,
      status: { not: SlotStatus.REMOVED },
    },
    select: { startsAt: true, endsAt: true },
  });

  const overlaps = existing.some(
    (s) => startsAt < s.endsAt && endsAt > s.startsAt,
  );
  if (overlaps) {
    throw new SlotConflictError();
  }

  return prisma.timeSlot.create({
    data: {
      professionalId,
      startsAt,
      endsAt,
      status: SlotStatus.AVAILABLE,
    },
  });
}

/**
 * Removes a slot the professional owns, but only if it is not booked (Req 4.5).
 * Uses soft-removal (status = REMOVED) so historical references stay intact.
 */
export async function removeSlot(professionalId: string, slotId: string) {
  const slot = await prisma.timeSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.professionalId !== professionalId) {
    throw new SlotNotFoundError();
  }
  if (slot.status === SlotStatus.BOOKED) {
    throw new SlotBookedError();
  }
  if (slot.status === SlotStatus.REMOVED) {
    return slot; // idempotent
  }
  return prisma.timeSlot.update({
    where: { id: slotId },
    data: { status: SlotStatus.REMOVED },
  });
}
