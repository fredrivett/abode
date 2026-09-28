import type { Quad } from "@/lib/scanner/geometry";
import type { LockStatus } from "@/lib/scanner/lock-tracker";
import { cn } from "@/lib/utils";

interface QuadOverlayProps {
  /** Outline in the overlay's own (CSS pixel) coordinates */
  quad: Quad | null;
  status: LockStatus;
  /** Pulses the outline while a capture is being processed */
  capturing?: boolean;
}

/** Highlights the detected page over the camera feed */
export function QuadOverlay({ quad, status, capturing }: QuadOverlayProps) {
  if (!quad) return null;
  const points = [
    quad.topLeft,
    quad.topRight,
    quad.bottomRight,
    quad.bottomLeft,
  ]
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
    >
      <polygon
        data-testid="quad-outline"
        data-status={status}
        points={points}
        strokeWidth={3}
        strokeLinejoin="round"
        className={cn(
          "transition-[fill,stroke] duration-200",
          status === "too-small"
            ? "fill-amber-400/15 stroke-amber-400"
            : "fill-sky-400/25 stroke-sky-400",
          status === "locked" && "fill-sky-400/40",
          capturing && "animate-pulse fill-white/50 stroke-white",
        )}
      />
    </svg>
  );
}
