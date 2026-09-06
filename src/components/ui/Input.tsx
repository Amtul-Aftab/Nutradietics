import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  const classes = ["input", invalid ? "input--invalid" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      ref={ref}
      className={classes}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
