import { cn } from "@/lib/utils";

// Row widths (% of column) that stand in for the essay's body text — a couple
// of paragraphs of greeked lines, so the page reads as paulgraham.com without
// reproducing the real essay. 0 marks a paragraph gap. Keyed up-front so the
// render doesn't lean on array indices.
const BODY_ROWS = [
  98, 94, 96, 88, 60, 0, 92, 97, 90, 95, 84, 68, 0, 96, 89, 72,
].map((w, i) => ({ key: `row-${i}`, w }));

/**
 * A minimal paulgraham.com essay page, shown inside the browser chrome when the
 * vignette switches to the essay tab. It fills the window interior and fades
 * in/out over the grid with `show`.
 */
export function EssayPage({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 z-20 overflow-hidden rounded-[2.5rem] bg-[#faf9f6] transition-opacity duration-500 ease-out",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="mx-auto max-w-2xl px-14 py-14">
        <h1 className="font-serif text-3xl text-neutral-900 leading-tight tracking-tight">
          How to Start a Startup
        </h1>
        <p className="mt-3 text-neutral-500 text-sm">
          Paul Graham · March 2005
        </p>
        <div className="mt-9 flex flex-col gap-3.5">
          {BODY_ROWS.map((row) =>
            row.w === 0 ? (
              // paragraph break
              <div key={row.key} className="h-2" />
            ) : (
              <div
                key={row.key}
                className="h-3 rounded-full bg-neutral-300/70"
                style={{ width: `${row.w}%` }}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
