import { OTPInput, OTPInputContext } from "input-otp";
import {
  type ButtonHTMLAttributes,
  type ComponentProps,
  type InputHTMLAttributes,
  useContext,
  useEffect,
  useState,
} from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
  ghost: "hover:bg-accent hover:text-accent-foreground",
};

export function Button({
  className = "",
  variant = "primary",
  // Default to "button" so this shared primitive never submits a form by
  // accident; callers that want submission pass type="submit" explicitly.
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      {...props}
    />
  );
}

// One-time-code input, ported from the web app's shadcn InputOTP
// (app/src/components/ui/input-otp.tsx) so 2FA codes look the same in both
export function InputOTP({
  className = "",
  containerClassName = "",
  ...props
}: ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      containerClassName={`flex items-center gap-2 has-disabled:opacity-50 ${containerClassName}`}
      className={`disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}

export function InputOTPGroup({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return <div className={`flex items-center ${className}`} {...props} />;
}

export function InputOTPSlot({
  index,
  className = "",
  ...props
}: ComponentProps<"div"> & { index: number }) {
  const { char, hasFakeCaret, isActive } =
    useContext(OTPInputContext)?.slots[index] ?? {};
  return (
    <div
      data-active={isActive}
      className={`relative flex size-10 items-center justify-center border-y border-r border-input bg-background text-base shadow-xs outline-none transition-all first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 dark:bg-input/30 ${className}`}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground" />
        </div>
      )}
    </div>
  );
}

// Animated trailing dots for loading labels ("Saving…"). Uses non-breaking
// spaces so the label width stays fixed as dots cycle.
const ELLIPSIS_STATES = ["   ", ".  ", ".. ", "..."];

export function LoadingEllipsis() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setStep((prev) => (prev + 1) % 4), 500);
    return () => clearInterval(interval);
  }, []);
  return <span>{ELLIPSIS_STATES[step]}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
