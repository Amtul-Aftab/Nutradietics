"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

interface CrossTypeSuggestionProps {
  message: string;
  otherTypeLabel: string;
}

/**
 * Supportive UI-only nudge shown on the match-result / confirmation screens
 * when the client's goal often benefits from the other professional type too.
 * The button starts a brand-new, independent intake (Req 10.7).
 */
export function CrossTypeSuggestion({
  message,
  otherTypeLabel,
}: CrossTypeSuggestionProps) {
  return (
    <aside className="cross-suggest" role="note">
      <p className="cross-suggest__msg">{message}</p>
      <Link href="/client/intake?fresh=1">
        <Button variant="secondary">Get matched with a {otherTypeLabel}</Button>
      </Link>
    </aside>
  );
}
