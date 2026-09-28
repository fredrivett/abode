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
      <AbodeLogo
        className={cn("ml-0.5 h-[0.8em] w-auto text-current", className)}
        aria-hidden
      />
    </span>
  );
}
