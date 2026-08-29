import { Check } from "lucide-react";
import { AbodeLogo } from "@/components/abode-logo";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved";

/**
 * A replica of the browser extension's Save popup, dropped from the extension
 * button in the chrome during the vignette. Purely decorative (non-interactive)
 * but mirrors the real popup's page card + Save → Saving… → Saved states.
 */
export function ExtensionPopup({
  show,
  state,
}: {
  show: boolean;
  state: SaveState;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-3 right-3 z-30 w-96 origin-top-right transition-all duration-300 ease-out",
        show ? "scale-100 opacity-100" : "scale-95 opacity-0",
      )}
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 text-left shadow-2xl">
        <AbodeLogo className="h-6 w-auto text-foreground" aria-label="abode" />

        {/* the page being saved */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5">
          {/* biome-ignore lint/performance/noImgElement: tiny static favicon */}
          <img
            src="/pg-favicon.png"
            alt=""
            className="size-5 shrink-0 rounded-[4px]"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-[15px]">
              How to Start a Startup
            </p>
            <p className="truncate text-muted-foreground text-sm">
              paulgraham.com
            </p>
          </div>
        </div>

        {state === "saved" ? (
          <Button variant="secondary" disabled className="w-full">
            <Check className="size-4" /> Saved
          </Button>
        ) : (
          <Button
            disabled={state === "saving"}
            tabIndex={-1}
            className="w-full"
          >
            {state === "saving" ? (
              <IsLoading label="Saving" />
            ) : (
              "Save this page"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
