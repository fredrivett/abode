import { AbodeLogo } from "@/components/abode-logo";
import { cn } from "@/lib/utils";

/**
 * The abode wordmark set inline in running text or headings, sized to the
 * surrounding font. Screen readers and search engines get the word "abode"
 */
export function AbodeInline({ className }: { className?: string }) {
  return (
    <span className="inline-flex items-baseline">
      <span className="sr-only">abode</span>
      {/* Nudged down 0.02em: the logo's round letters end flush with its box,
          while fonts' round glyphs overshoot the baseline by about that much */}
      <AbodeLogo
        className={cn(
          "h-[0.8em] w-auto translate-y-[0.02em] text-current",
          className,
        )}
        // The sr-only text already names it; a title here would read "abode" twice
        title=""
        aria-hidden
      />
    </span>
  );
}

/** Renders text with every standalone "abode" swapped for the inline wordmark */
export function AbodeText({ children }: { children: string }) {
  const [first, ...rest] = children.split(/\babode\b/);
  return (
    <>
      {first}
      {rest.map((part, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and static
        <span key={i}>
          <AbodeInline />
          {part}
        </span>
      ))}
    </>
  );
}
