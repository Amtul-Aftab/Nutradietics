"use client";

import { useEffect } from "react";
import { ErrorBanner } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="route-error">
      <ErrorBanner title="Something went wrong" onRetry={reset}>
        <p>
          An unexpected error occurred. You can try again, or refresh the page.
        </p>
      </ErrorBanner>
    </main>
  );
}
