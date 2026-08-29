import { cn } from "@/lib/utils";

// Placeholder (lorem ipsum) body copy so the page reads as an article without
// reproducing the real essay. Keyed up-front so the render doesn't lean on
// array indices.
const PARAGRAPHS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est qui dolorem ipsum quia dolor sit amet.",
].map((text, i) => ({ key: `p${i}`, text }));

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
        <div className="mt-8 flex flex-col gap-4 text-[13px] text-neutral-700 leading-[1.75]">
          {PARAGRAPHS.map((p) => (
            <p key={p.key}>{p.text}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
