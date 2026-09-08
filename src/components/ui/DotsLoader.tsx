// General-purpose loading indicator: four dots bouncing in a staggered wave,
// colored teal -> coral. Purely visual, no logic.
// - default: dots + "Loading" label underneath (page/section loads)
// - inline:  just the dots, no label (fits inside buttons next to text)

interface DotsLoaderProps {
  inline?: boolean;
  label?: string;
}

export function DotsLoader({ inline = false, label = "Loading" }: DotsLoaderProps) {
  const dots = (
    <span
      className={inline ? "dots dots--inline" : "dots"}
      role="status"
      aria-live="polite"
    >
      <span className="dots__dot" />
      <span className="dots__dot" />
      <span className="dots__dot" />
      <span className="dots__dot" />
      <span className="sr-only">{label}</span>
    </span>
  );

  if (inline) return dots;

  return (
    <span className="dots-loader">
      {dots}
      <span className="dots-loader__label">{label}</span>
    </span>
  );
}
