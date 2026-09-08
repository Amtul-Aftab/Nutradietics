// Currency formatting for the platform. Prices are stored as whole PKR
// integers in the `priceCents` column (the column name is legacy; it now holds
// whole rupees, not paisa/cents — see design.md). All price display goes
// through formatPkr so there is a single source of truth.

/**
 * Formats a whole-PKR integer amount for display, e.g. 5000 -> "Rs 5,000".
 * Uses thousands separators and no decimals.
 */
export function formatPkr(amount: number): string {
  const whole = Math.max(0, Math.round(amount));
  return `Rs ${whole.toLocaleString("en-PK")}`;
}
