import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * The paste shortcut (⌘ / Ctrl + V), shown large at the bottom of the window
 * during the "paste a link" step — each key its own keycap. The modifier symbol
 * is device-aware (passed in from the shared `getModifierKeySymbol`). Purely
 * decorative; fades in/out with `show`.
 */
export function PasteKeys({ show, modSym }: { show: boolean; modSym: string }) {
  const keyClass =
    "h-28 min-w-28 rounded-2xl border border-border bg-background px-6 font-medium text-5xl text-foreground shadow-xl transition-all duration-200 ease-out";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-10 z-30 flex items-center justify-center gap-5"
    >
      {/* the modifier presses in first and is held; V follows a beat later —
          like pressing the shortcut in quick succession. */}
      <Kbd
        className={cn(
          keyClass,
          show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        {modSym}
      </Kbd>
      <Kbd
        className={cn(
          keyClass,
          show
            ? "translate-y-0 opacity-100 [transition-delay:220ms]"
            : "translate-y-4 opacity-0",
        )}
      >
        V
      </Kbd>
    </div>
  );
}
