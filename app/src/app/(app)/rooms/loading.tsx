const CARD_KEYS = ["r1", "r2", "r3", "r4", "r5", "r6"];

/**
 * Shown while the rooms list loads (the page renders its own header, so this
 * stands in for it too), so a slow network gets immediate feedback on tap.
 */
export default function RoomsLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="h-16" />
      <div role="status" className="mx-auto w-full max-w-5xl px-4 py-8">
        <span className="sr-only">Loading your rooms</span>
        <div className="mb-6 h-8 w-32 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARD_KEYS.map((key) => (
            <div key={key} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
