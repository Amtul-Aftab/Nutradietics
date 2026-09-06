import type { ReactNode } from "react";
import { Button } from "./Button";

interface ErrorBannerProps {
  title?: string;
  children: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorBanner({
  title = "Something went wrong",
  children,
  onRetry,
  retrying,
}: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <div className="error-banner__body">
        <strong className="error-banner__title">{title}</strong>
        <div className="error-banner__message">{children}</div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} loading={retrying}>
          Retry
        </Button>
      )}
    </div>
  );
}
