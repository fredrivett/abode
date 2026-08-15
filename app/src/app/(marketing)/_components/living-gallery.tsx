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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

export function LivingGallery() {
  // Effect is opt-in per device: desktop pointers, no reduced-motion. Off by
  // default so SSR + first client render match (the plain grid).
  const [effectOn, setEffectOn] = useState(false);
  // Cards have reached the grid — swap the flying overlay for the real grid.
  const [settled, setSettled] = useState(false);

  const gridRef = useRef<HTMLUListElement>(null);
  const liRefs = useRef<(HTMLLIElement | null)[]>([]);
  const flyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const settledRef = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 768px)");
    const sync = () => setEffectOn(wide.matches && !reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  // Once the cards settle the rAF loop stops, so the static gallery is idle
  // (no perpetual 60fps layout measurement). A scroll/resize back out of the
  // settled position unsettles, which restarts the loop below. While unsettled
  // the loop itself tracks scroll, so this listener only matters when settled.
  useEffect(() => {
    if (!effectOn) {
      setSettled(false);
      settledRef.current = false;
      return;
    }
    const maybeUnsettle = () => {
      if (!settledRef.current) return;
      const grid = gridRef.current;
      if (!grid) return;
      const vh = window.innerHeight;
      const p = (vh - grid.getBoundingClientRect().top) / (vh * 0.85);
      if (p < 0.98) {
        settledRef.current = false;
        setSettled(false);
      }
    };
    window.addEventListener("scroll", maybeUnsettle, { passive: true });
    window.addEventListener("resize", maybeUnsettle);
    return () => {
      window.removeEventListener("scroll", maybeUnsettle);
      window.removeEventListener("resize", maybeUnsettle);
    };
  }, [effectOn]);

  // Drift + fly-in animation. Runs only while unsettled; once the cards reach
  // the grid it stops (settles) and the effect stays dormant until a scroll
  // unsettles it again.
  useEffect(() => {
    if (!effectOn || settled) return;
    let raf = 0;
    const tick = (now: number) => {
      const grid = gridRef.current;
      if (grid) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Progress: 0 while the grid sits below the fold, 1 once its top rises
        // to ~15% down the viewport (cards fully slotted).
        const gridTop = grid.getBoundingClientRect().top;
        const p = easeInOut(clamp01((vh - gridTop) / (vh * 0.85)));

        if (p >= 0.999) {
          settledRef.current = true;
          setSettled(true);
          return; // stop the loop; it won't restart while settled
        }

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

  return (
    <section className="relative w-full max-w-5xl px-4 py-24">
      <div className="relative z-10 mx-auto max-w-xl text-center">
        <h2 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          this is your abode.
        </h2>
        <p className="mt-5 text-balance text-lg text-muted-foreground leading-relaxed">
          save anything — a link, a photo, a thought. abode reads it,
          understands it, and files it for you.{" "}
          <span className="whitespace-nowrap text-foreground">
            Hover a card
          </span>{" "}
          to see what it already knows.
        </p>
      </div>

      {/* Flying overlay — mirrors each grid card while it drifts in from the
          edges. Fixed to the viewport, behind the hero, non-interactive. */}
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

      <ul
        ref={gridRef}
        className={cn(
          "relative z-10 mt-14 columns-2 gap-4 sm:columns-3 [&>li]:mb-4",
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
    </section>
  );
}
