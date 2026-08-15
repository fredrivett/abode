"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CardBody,
  faceClass,
  faceStyle,
  hoverClass,
  Intelligence,
} from "./gallery-card";
import { GALLERY_CARDS } from "./gallery-data";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// The three ways things get into abode. `soon` marks the not-yet-built one.
const STEPS = [
  {
    id: "paste",
    label: "paste a link",
    body: "⌘V anywhere — a tweet, an article, a video. abode grabs the link and builds the card.",
  },
  {
    id: "drop",
    label: "drag & drop",
    body: "Drop an image or file straight onto abode. It uploads and files itself.",
  },
  {
    id: "clip",
    label: "clip from anywhere",
    body: "Save what you're reading with the browser extension, without leaving the page.",
    soon: true,
  },
];

// Fraction of the scrolled range spent scooting the grid left before the steps
// begin.
const SCOOT_RANGE = 0.14;

export function CaptureSection() {
  // Pinned scrollytelling is a desktop (lg+) treatment and off under
  // reduced-motion. Off by default so SSR matches the static fallback.
  const [enabled, setEnabled] = useState(false);
  const [scoot, setScoot] = useState(0);
  const [scrollStep, setScrollStep] = useState(0);
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeStep = hoverStep ?? scrollStep;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px)");
    const sync = () => setEnabled(wide.matches && !reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  // Scroll drives the scoot (grid → left) then which step is active. Updates run
  // only on scroll/resize (rAF-throttled), so the section is idle when still.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = wrapperRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const q =
        total > 0 ? clamp01(-el.getBoundingClientRect().top / total) : 0;
      setScoot(clamp01(q / SCOOT_RANGE));
      const band = (1 - SCOOT_RANGE) / STEPS.length;
      setScrollStep(
        Math.min(
          STEPS.length - 1,
          Math.max(0, Math.floor((q - SCOOT_RANGE) / band)),
        ),
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  // Grid sits centred on entry (captions hidden to the right), then slides left
  // as the captions fade in.
  const gridShift = enabled ? (1 - scoot) * 150 : 0;
  const captionsOpacity = enabled ? scoot : 1;

  return (
    <section
      ref={wrapperRef}
      // ~1 screen of scoot + 1 per step; below lg it's a normal static block.
      className={cn("relative w-full", enabled ? "h-[360vh]" : "py-24")}
    >
      <div
        className={cn(
          "flex w-full items-center",
          enabled && "sticky top-0 h-screen overflow-hidden bg-background",
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 lg:flex-row lg:items-center lg:gap-8">
          {/* Left — the wall (same cards as section 2), scoots left */}
          <div
            className="min-w-0 flex-1"
            style={
              enabled ? { transform: `translateX(${gridShift}px)` } : undefined
            }
          >
            <ul className="columns-2 gap-4 lg:columns-3 [&>li]:mb-4">
              {GALLERY_CARDS.map((card) => (
                <li
                  key={card.id}
                  className="group relative mb-4 break-inside-avoid"
                >
                  <div
                    className={cn(faceClass(card), hoverClass(card))}
                    style={faceStyle(card)}
                  >
                    <CardBody card={card} />
                    <Intelligence card={card} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — the step narration (scroll- or hover-driven) */}
          <div
            className="w-full shrink-0 lg:w-80"
            style={{ opacity: captionsOpacity }}
          >
            <h2 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight">
              save anything.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              however it reaches you, it lands in one place.
            </p>

            <ol className="mt-8 flex flex-col gap-2">
              {STEPS.map((step, i) => {
                const active = i === activeStep;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHoverStep(i)}
                      onMouseLeave={() => setHoverStep(null)}
                      onFocus={() => setHoverStep(i)}
                      onBlur={() => setHoverStep(null)}
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition-colors duration-300",
                        active
                          ? "border-border bg-muted/50"
                          : "border-transparent opacity-50 hover:opacity-80",
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        {step.label}
                        {step.soon && (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                            soon
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-muted-foreground text-sm leading-snug transition-[max-height,opacity] duration-300",
                          active
                            ? "max-h-24 opacity-100"
                            : "max-h-0 overflow-hidden opacity-0",
                        )}
                      >
                        {step.body}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Placeholder for the capture vignette (built next). */}
            <div className="mt-6 flex h-20 items-center justify-center rounded-xl border border-border border-dashed text-muted-foreground text-xs">
              step {activeStep + 1} demo · coming next
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
