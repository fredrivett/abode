import { cn } from "@/lib/utils";

// A short opening excerpt of the essay (gruhn.me) — enough to fill the visible
// window without reproducing the whole post. Keyed up-front so the render
// doesn't lean on array indices.
const PARAGRAPHS = [
  "Too often I ask a question in Slack, leave feedback on a pull request, or argue with friends in a group chat — and get back a giant, verbatim AI response. Please don't do this.",
  "I can talk to Claude myself. It's faster, and I get to control the context. I don't need a meat proxy in between.",
  "Reading AI output is extra effort. It's verbose, frequently contains all-too-plausible nonsense, and is increasingly jargon-dense.",
  "By all means, prompt the AI — but don't just relay the output.",
].map((text, i) => ({ key: `p${i}`, text }));

/**
 * A minimal blog-post page (gruhn.me), shown inside the browser chrome when the
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
          Don't be a meat proxy
        </h1>
        <p className="mt-3 text-neutral-500 text-sm">Niklas Gruhn · Aug 2026</p>
        <div className="mt-8 flex flex-col gap-4 text-[13px] text-neutral-700 leading-[1.75]">
          {PARAGRAPHS.map((p) => (
            <p key={p.key}>{p.text}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
