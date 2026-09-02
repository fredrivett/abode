// Scroll-position rail for a capture step: a dot when inactive, and an
// elongated pill that fills top-to-bottom as you scroll through the active
// step's band. `progress` (0→1) drives the fill; it's floored at 10% so the
// active pill always reads as a pill rather than an empty track.
export function StepRail({
  active,
  progress,
}: {
  active: boolean;
  progress: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex w-1.5 shrink-0 items-stretch justify-center py-1.5"
    >
      {active ? (
        <div className="relative w-full flex-1 overflow-hidden rounded-full bg-foreground/15">
          <div
            className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-foreground/50 to-foreground"
            style={{ height: `${Math.max(10, progress * 100)}%` }}
          />
        </div>
      ) : (
        <div className="my-auto size-1.5 rounded-full bg-foreground/25" />
      )}
    </div>
  );
}
