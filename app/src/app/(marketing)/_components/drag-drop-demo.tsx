"use client";

import { ImageUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** The macOS arrow pointer — black fill with a white outline. */
function MacCursor({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <title>cursor</title>
      <path
        d="M4.5 2 L4.5 18.6 L8.9 14.6 L11.7 21 L14.4 19.8 L11.8 13.6 L17.6 13.6 Z"
        fill="#000"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The drag & drop demo, shown over the wall during the "drag & drop" step: a
 * cursor drags the image in from off-screen along an arc to the middle of the
 * dropzone, then drops it — after which it grows into the wall as a new card.
 * Purely decorative; fades in/out with `show`.
 */
export function DragDropDemo({
  show,
  dropping,
}: {
  show: boolean;
  dropping: boolean;
}) {
  // Once shown, flip to "arrived" on the next frame so the held file glides in
  // from off-screen to the dropzone rather than starting there.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!show) {
      setArrived(false);
      return;
    }
    const raf = requestAnimationFrame(() => setArrived(true));
    return () => cancelAnimationFrame(raf);
  }, [show]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-[2.5rem] transition-opacity duration-300 ease-out",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      {/* dropzone tint + dashed border over the wall */}
      <div className="absolute inset-3 rounded-[2rem] border-2 border-foreground/20 border-dashed bg-background/70 backdrop-blur-[2px]" />

      {/* Arc = two axes with opposite easings: Y leads (fast up), X trails (slow
          left), so the file swings up-and-over from bottom-right to centre. */}
      <div
        style={{
          transform: `translateX(${arrived ? "0%" : "64%"})`,
          transition: "transform 950ms cubic-bezier(0.4, 0, 1, 1)",
        }}
      >
        <div
          style={{
            transform: `translateY(${arrived ? "0%" : "116%"})`,
            transition: "transform 950ms cubic-bezier(0, 0, 0.35, 1)",
          }}
        >
          {/* image + cursor — rotates upright as it arrives, drops on release */}
          <div
            className="relative"
            style={{
              transform: dropping
                ? "translateY(46px) scale(0.9)"
                : `rotate(${arrived ? -3 : -12}deg)`,
              opacity: dropping ? 0 : 1,
              transition: dropping
                ? "transform 450ms ease-in, opacity 450ms ease-in"
                : "transform 950ms ease-out",
            }}
          >
            <div className="w-44 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10">
              {/* biome-ignore lint/performance/noImgElement: static marketing asset */}
              <img
                src="/gallery/bo-kaap-car.jpg"
                alt=""
                className="block w-full"
              />
            </div>
            {/* cursor tip resting in the middle of the page (image centre) */}
            <MacCursor className="-translate-x-[5px] -translate-y-[2px] absolute top-1/2 left-1/2 size-7 drop-shadow-md" />
          </div>
        </div>
      </div>

      {/* label */}
      <div className="absolute bottom-10 flex items-center gap-2 font-medium text-foreground/70 text-sm">
        <ImageUp className="size-4" />
        drop your image to upload
      </div>
    </div>
  );
}
