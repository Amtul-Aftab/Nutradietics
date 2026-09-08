// Shared presentational formatters (human-readable enums, consistent dates).

/**
 * Turns an enum-style value into a human-readable label:
 * "FITNESS_TRAINER" -> "Fitness Trainer", "PENDING" -> "Pending".
 */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};
const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. "Tue, Sep 10, 10:00 AM" */
export function formatDateTime(value: Date | string): string {
  const d = toDate(value);
  return `${d.toLocaleDateString(undefined, DATE_OPTS)}, ${d.toLocaleTimeString(undefined, TIME_OPTS)}`;
}

/** e.g. "Tue, Sep 10, 10:00 AM - 11:00 AM" */
export function formatRange(
  startsAt: Date | string,
  endsAt: Date | string,
): string {
  const start = toDate(startsAt);
  const end = toDate(endsAt);
  return `${start.toLocaleDateString(undefined, DATE_OPTS)}, ${start.toLocaleTimeString(undefined, TIME_OPTS)} - ${end.toLocaleTimeString(undefined, TIME_OPTS)}`;
}

/** Longer form with year, e.g. "Sep 10, 2026, 10:00 AM" (for history timestamps) */
export function formatTimestamp(value: Date | string): string {
  return toDate(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
