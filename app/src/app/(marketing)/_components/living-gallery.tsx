"use client";

import { AppWindow, ClipboardPaste, Upload } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { getModifierKeySymbol } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import {
  CardBody,
  faceClass,
  faceStyle,
  hoverClass,
  Intelligence,
} from "./gallery-card";
import { GALLERY_CARDS } from "./gallery-data";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

// The three ways things get into abode. `soon` marks the not-yet-built one.
const STEPS = [
  {
    id: "paste",
    icon: ClipboardPaste,
    label: "paste a link",
    body: "{paste} a tweet anywhere in abode — it grabs the link and builds the card.",
  },
  {
    id: "drop",
    icon: Upload,
    label: "drag & drop",
    body: "drop an image or file straight onto abode. it uploads and files itself.",
  },
  {
    id: "clip",
    icon: AppWindow,
    label: "clip from anywhere",
    body: "save what you're reading with the browser extension, without leaving the page.",
    soon: true,
  },
];

// Capture phase scroll budget (× viewport height) and the fraction of it spent
// scooting the wall left before the steps begin.
const CAPTURE_VH = 2.2;
const SCOOT_FRAC = 0.22;

export function LivingGallery() {
  // The whole choreography (fly-in + capture) is a desktop (lg+) treatment and
  // off under reduced-motion. Off by default so SSR matches the static grid.
  const [effectOn, setEffectOn] = useState(false);
  // Cards have flown in — swap the flying overlay for the real grid.
  const [settled, setSettled] = useState(false);
  // Capture phase: 0 = wall settled/centred, 1 = wall scooted left + column in.
  const [scoot, setScoot] = useState(0);
  // Which capture step is active — driven purely by scroll position.
  const [activeStep, setActiveStep] = useState(0);
  // Platform-correct modifier symbol (⌘ on Apple, Ctrl elsewhere). Resolved
  // after mount to avoid an SSR/client mismatch; defaults to the Mac form.
  const [modSym, setModSym] = useState("⌘");

  const wrapperRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const liRefs = useRef<(HTMLLIElement | null)[]>([]);
  const flyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const settledRef = useRef(false);

  // Smooth-scroll to the middle of a step's scroll band (makes it active).
  const scrollToStep = (i: number) => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const sectionTop = wrap.getBoundingClientRect().top + window.scrollY;
    const band = (1 - SCOOT_FRAC) / STEPS.length;
    const targetCap = SCOOT_FRAC + (i + 0.5) * band;
    window.scrollTo({
      top: sectionTop + targetCap * window.innerHeight * CAPTURE_VH,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    setModSym(getModifierKeySymbol());
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px)");
    const sync = () => setEffectOn(wide.matches && !reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  // Scroll handler: drives the capture phase (scoot + active step) once the wall
  // has settled and pins, and unsettles when scrolled back above the fly-in.
  // Runs only on scroll/resize (rAF-throttled) so it's idle when still.
  useEffect(() => {
    if (!effectOn) {
      setSettled(false);
      settledRef.current = false;
      setScoot(0);
      setActiveStep(0);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const vh = window.innerHeight;
      // Single source of truth for the whole choreography, from the section's
      // top: settled (fly-in done), scoot, and active step. Deriving all three
      // from one measurement keeps them from desyncing on fast scrolls.
      const secTop = wrap.getBoundingClientRect().top;
      const nowSettled =
        easeInOut(clamp01((vh - secTop) / (vh * 0.85))) >= 0.999;
      if (nowSettled !== settledRef.current) {
        settledRef.current = nowSettled;
        setSettled(nowSettled);
      }
      // Capture progress runs from where the stage pins (secTop = 0).
      const cap = clamp01(-secTop / (vh * CAPTURE_VH));
      setScoot(clamp01(cap / SCOOT_FRAC));
      const band = (1 - SCOOT_FRAC) / STEPS.length;
      setActiveStep(
        Math.min(
          STEPS.length - 1,
          Math.max(0, Math.floor((cap - SCOOT_FRAC) / band)),
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
  }, [effectOn]);

  // Drift + fly-in animation. Runs only while unsettled (settled is owned by
  // the scroll handler); the cards scatter around the hero and fly into the
  // grid as it rises. Each frame re-reads the section's position, so cards can
  // never freeze out of sync with the current scroll.
  useEffect(() => {
    if (!effectOn || settled) return;
    let raf = 0;
    const tick = (now: number) => {
      const grid = gridRef.current;
      const wrap = wrapperRef.current;
      if (grid && wrap) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Progress off the section top (it reaches 0 at pin); the grid top never
        // does — it rests ~a heading below the viewport top once pinned.
        const secTop = wrap.getBoundingClientRect().top;
        const p = easeInOut(clamp01((vh - secTop) / (vh * 0.85)));
        for (let i = 0; i < GALLERY_CARDS.length; i++) {
          const node = flyRefs.current[i];
          const li = liRefs.current[i];
          const s = GALLERY_CARDS[i].scatter;
          if (!node || !li) continue;
          const t = li.getBoundingClientRect();
          const drift = (1 - p) * s.amp * Math.sin(now / s.period + s.phase);
          const x = lerp(s.x * vw, t.left, p);
          const y = lerp(s.y * vh, t.top, p) + drift;
          const scale = lerp(s.scale, 1, p);
          const rot = lerp(s.rot, 0, p);
          const blur = lerp(s.blur, 0, p);
          node.style.width = `${t.width}px`;
          node.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rot}deg)`;
          node.style.opacity = `${lerp(s.opacity, 1, p)}`;
          node.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
          node.style.zIndex = `${s.z}`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [effectOn, settled]);

  const flying = effectOn && !settled;

  // The wall shrinks as the capture column fades in. Anchored to its left edge,
  // so shrinking pulls the right edge in and opens a gutter before the column;
  // vertical centring is handled by the flex stage.
  const wallStyle: CSSProperties | undefined = effectOn
    ? {
        transform: `scale(${1 - scoot * 0.34})`,
        transformOrigin: "left center",
      }
    : undefined;

  return (
    <section ref={wrapperRef} className="relative w-full">
      {/* Flying overlay — mirrors each grid card while it drifts in from the
          edges of the hero. Fixed to the viewport, behind the hero. */}
      {flying && (
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
          {GALLERY_CARDS.map((card, i) => (
            <div
              key={card.id}
              ref={(el) => {
                flyRefs.current[i] = el;
              }}
              className={cn(
                faceClass(card),
                "absolute top-0 left-0 will-change-transform",
              )}
              style={{
                transformOrigin: "top left",
                opacity: 0,
                ...faceStyle(card),
              }}
            >
              <CardBody card={card} />
            </div>
          ))}
        </div>
      )}

      {/* Pinned stage — the wall settles here (vertically centred), then scoots
          left for capture. */}
      <div
        className={cn(
          effectOn
            ? "sticky top-0 flex h-screen items-center overflow-hidden"
            : "py-24",
        )}
      >
        <div className="relative mx-auto w-full max-w-6xl px-4">
          {/* Intro heading — collapses + fades as the capture column takes
              over, so the wall alone centres. */}
          <div
            className="mx-auto max-w-xl overflow-hidden text-center"
            style={
              effectOn
                ? {
                    opacity: clamp01(1 - scoot * 1.7),
                    maxHeight: `${(1 - clamp01(scoot * 1.5)) * 8}rem`,
                    marginBottom: `${(1 - clamp01(scoot * 1.5)) * 3.5}rem`,
                  }
                : { marginBottom: "3.5rem" }
            }
          >
            <h2 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
              this is{" "}
              <span className="rounded-lg bg-foreground/[0.07] px-2 py-0.5">
                your
              </span>{" "}
              abode.
            </h2>
          </div>

          {/* The wall */}
          <div style={wallStyle}>
            <ul
              ref={gridRef}
              className={cn(
                "relative z-10 columns-2 gap-4 sm:columns-3 [&>li]:mb-4",
                flying && "invisible",
              )}
            >
              {GALLERY_CARDS.map((card, i) => (
                <li
                  key={card.id}
                  ref={(el) => {
                    liRefs.current[i] = el;
                  }}
                  className="group relative break-inside-avoid"
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

          {/* Capture column — fades/slides in from the right during the scoot. */}
          {effectOn && (
            <div
              className="pointer-events-auto absolute top-1/2 right-0 w-80"
              style={{
                opacity: scoot,
                transform: `translate(${(1 - scoot) * 32}px, -50%)`,
              }}
            >
              <h3 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight">
                save anything.
              </h3>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                however it reaches you, it lands in one place.
              </p>
              <ol className="mt-8 flex flex-col gap-2">
                {STEPS.map((step, i) => {
                  const active = i === activeStep;
                  const StepIcon = step.icon;
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => scrollToStep(i)}
                        className={cn(
                          "w-full cursor-pointer rounded-xl border p-4 text-left transition-[opacity,background-color,border-color] duration-300",
                          active
                            ? "border-border bg-muted/50"
                            : "border-transparent opacity-50 hover:opacity-80",
                        )}
                      >
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <StepIcon className="size-4 shrink-0 text-muted-foreground" />
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
                          {step.body.includes("{paste}") ? (
                            <>
                              <KbdGroup className="align-middle">
                                <Kbd>{modSym}</Kbd>
                                <Kbd>V</Kbd>
                              </KbdGroup>{" "}
                              {step.body.replace("{paste} ", "")}
                            </>
                          ) : (
                            step.body
                          )}
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
          )}
        </div>
      </div>

      {/* Scroll budget for the capture phase (only while pinned). */}
      {effectOn && <div style={{ height: `${CAPTURE_VH * 100}vh` }} />}
    </section>
  );
}
