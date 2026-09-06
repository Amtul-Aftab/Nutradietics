interface SpinnerProps {
  size?: number;
  inline?: boolean;
  label?: string;
}

export function Spinner({ size = 24, inline = false, label }: SpinnerProps) {
  return (
    <span
      className={inline ? "spinner spinner--inline" : "spinner"}
      role="status"
      aria-live="polite"
      style={{ width: size, height: size }}
    >
      <span className="spinner__ring" style={{ width: size, height: size }} />
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}
