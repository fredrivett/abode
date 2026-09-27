import { cn } from "@/lib/utils";

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ShutterButtonProps {
  onClick: () => void;
  /** 0..1 auto-capture countdown shown as a ring; null hides the ring */
  progress: number | null;
  disabled?: boolean;
}

/** Camera shutter; in auto mode a ring fills while the page is held steady */
export function ShutterButton({
  onClick,
  progress,
  disabled,
}: ShutterButtonProps) {
  const clamped = progress === null ? 0 : Math.min(1, Math.max(0, progress));
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Capture page"
      className="relative flex size-20 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-50"
    >
      <svg
        viewBox="0 0 80 80"
        className="-rotate-90 absolute inset-0 size-full"
        aria-hidden="true"
      >
        <circle
          cx="40"
          cy="40"
          r={RADIUS}
          fill="none"
          strokeWidth="5"
          className="stroke-white/40"
        />
        {progress !== null ? (
          <circle
            data-testid="shutter-progress"
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
            className={cn(
              "stroke-sky-400",
              // Snap back instantly on reset, animate smoothly while filling
              clamped > 0 && "transition-[stroke-dashoffset] duration-150",
            )}
          />
        ) : null}
      </svg>
      <span className="size-[3.75rem] rounded-full bg-white shadow-md" />
    </button>
  );
}
