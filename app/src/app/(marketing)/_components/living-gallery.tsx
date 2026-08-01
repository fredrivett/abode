"use client";

import { FileText, Link2, Package, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GALLERY_CARDS, type GalleryCard } from "./gallery-data";

const BOX_CLASS =
  "relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

// Where each card floats before it settles — anchored to the viewport edges
// (fractions of the viewport) so the hero centre stays clear. Depth varies:
// distant cards are smaller, blurred, fainter and sit further back (lower z).
// Order matches GALLERY_CARDS.
type Scatter = {
  x: number;
  y: number;
  scale: number;
  blur: number;
  opacity: number;
  rot: number;
  z: number;
  amp: number;
  period: number;
  phase: number;
};

const SCATTER: Scatter[] = [
  // red arch (near, left-lower)
  {
    x: 0.01,
    y: 0.44,
    scale: 0.8,
    blur: 0,
    opacity: 0.95,
    rot: -4,
    z: 30,
    amp: 10,
    period: 7000,
    phase: 0,
  },
  // maps tweet (mid, right-upper)
  {
    x: 0.79,
    y: 0.08,
    scale: 0.66,
    blur: 2,
    opacity: 0.8,
    rot: 5,
    z: 20,
    amp: 8,
    period: 6200,
    phase: 1.4,
  },
  // reading note (far, top-left)
  {
    x: 0.09,
    y: 0.03,
    scale: 0.5,
    blur: 5,
    opacity: 0.55,
    rot: -8,
    z: 6,
    amp: 6,
    period: 8200,
    phase: 2.6,
  },
  // tiny desk video (near, right-lower)
  {
    x: 0.72,
    y: 0.6,
    scale: 0.82,
    blur: 0,
    opacity: 0.95,
    rot: 4,
    z: 30,
    amp: 10,
    period: 6600,
    phase: 0.8,
  },
  // city sunset (mid, left-upper)
  {
    x: 0.05,
    y: 0.04,
    scale: 0.62,
    blur: 3,
    opacity: 0.7,
    rot: -6,
    z: 15,
    amp: 7,
    period: 7400,
    phase: 3.3,
  },
  // moby book (near, right-mid)
  {
    x: 0.84,
    y: 0.36,
    scale: 0.78,
    blur: 0.5,
    opacity: 0.9,
    rot: 6,
    z: 28,
    amp: 9,
    period: 6900,
    phase: 4.1,
  },
  // startup article (far, bottom-left)
  {
    x: 0.15,
    y: 0.82,
    scale: 0.52,
    blur: 5,
    opacity: 0.55,
    rot: 7,
    z: 7,
    amp: 6,
    period: 8600,
    phase: 1.9,
  },
  // muybridge gif (mid, bottom-right)
  {
    x: 0.69,
    y: 0.85,
    scale: 0.6,
    blur: 3,
    opacity: 0.7,
    rot: -5,
    z: 14,
    amp: 7,
    period: 7700,
    phase: 5.0,
  },
  // turntable product (far, top-right)
  {
    x: 0.88,
    y: 0.68,
    scale: 0.48,
    blur: 6,
    opacity: 0.5,
    rot: 8,
    z: 5,
    amp: 5,
    period: 9000,
    phase: 2.2,
  },
];

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

  useEffect(() => {
    if (!effectOn) {
      setSettled(false);
      settledRef.current = false;
      return;
    }
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

        const nowSettled = p >= 0.999;
        if (nowSettled !== settledRef.current) {
          settledRef.current = nowSettled;
          setSettled(nowSettled);
        }

        if (!nowSettled) {
          for (let i = 0; i < GALLERY_CARDS.length; i++) {
            const node = flyRefs.current[i];
            const li = liRefs.current[i];
            const s = SCATTER[i];
            if (!node || !li || !s) continue;
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
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [effectOn]);

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
                BOX_CLASS,
                "absolute top-0 left-0 will-change-transform",
              )}
              style={{ transformOrigin: "top left", opacity: 0 }}
            >
              <CardMedia card={card} />
            </div>
          ))}
        </div>
      )}

      <ul
        ref={gridRef}
        className={cn(
          "relative z-10 mt-14 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4",
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
              className={cn(
                BOX_CLASS,
                "transition-[transform,box-shadow] duration-500 ease-out [transform-style:preserve-3d]",
                "group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:[transform:rotateX(5deg)]",
              )}
            >
              <CardMedia card={card} />
              <Intelligence card={card} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- the "understood" overlay — lifts forward off the card on hover ---

function Intelligence({ card }: { card: GalleryCard }) {
  const { kindLabel, tags, colors, objects } = card.insight;
  return (
    <div
      className={cn(
        "absolute inset-x-2 bottom-2 rounded-xl border border-border/60 bg-background/85 p-3 text-left shadow-lg backdrop-blur-md",
        "translate-y-3 opacity-0 transition-[transform,opacity] duration-500 ease-out",
        "group-hover:translate-y-0 group-hover:opacity-100 group-hover:[transform:translateZ(52px)]",
        "max-md:translate-y-0 max-md:opacity-100 max-md:[transform:none]",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {kindLabel}
        </span>
        {colors && (
          <span className="flex items-center gap-1">
            {colors.map((c) => (
              <span
                key={c.hex}
                title={c.name}
                className="size-3 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </span>
        )}
      </div>
      {objects && (
        <p className="mb-2 text-muted-foreground text-xs">
          sees {objects.slice(0, 3).join(" · ")}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- per-kind media / body ---

function CardMedia({ card }: { card: GalleryCard }) {
  switch (card.kind) {
    case "image":
      return (
        // biome-ignore lint/performance/noImgElement: static marketing asset, no proxy/context available
        <img
          src={card.src}
          alt={card.title}
          width={card.width}
          height={card.height}
          className="w-full object-cover"
          loading="lazy"
        />
      );
    case "video":
      return (
        <div className="relative">
          {/* biome-ignore lint/performance/noImgElement: remote thumbnail, no proxy available */}
          <img
            src={card.thumbnail}
            alt={card.title}
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
              <Play className="size-5 translate-x-0.5 fill-current" />
            </span>
          </span>
          <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 font-medium text-[11px] text-white">
            {card.duration}
          </span>
          <div className="p-3">
            <p className="line-clamp-2 font-medium text-sm">{card.title}</p>
            <p className="mt-1 text-muted-foreground text-xs">{card.channel}</p>
          </div>
        </div>
      );
    case "book":
      return (
        // biome-ignore lint/performance/noImgElement: static marketing asset
        <img
          src={card.cover}
          alt={card.title}
          className="w-full object-cover"
          loading="lazy"
        />
      );
    case "tweet":
      return (
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            {/* biome-ignore lint/performance/noImgElement: remote avatar svg */}
            <img
              src={card.avatar}
              alt=""
              className="size-8 rounded-full bg-muted"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-medium text-sm">{card.author}</p>
              <p className="truncate text-muted-foreground text-xs">
                @{card.handle}
              </p>
            </div>
          </div>
          <p className="text-[15px] leading-snug">{card.text}</p>
        </div>
      );
    case "note":
      return (
        <div className="bg-amber-50/60 p-4 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
            <FileText className="size-3.5" />
            {card.title && (
              <span className="font-medium text-foreground text-sm">
                {card.title}
              </span>
            )}
          </div>
          <p className="text-[15px] text-foreground/90 leading-snug">
            {card.body}
          </p>
        </div>
      );
    case "article":
      return (
        <div className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-muted-foreground text-xs">
            <Link2 className="size-3.5" />
            {card.domain}
          </div>
          <p className="font-medium text-base leading-snug">{card.title}</p>
          <p className="mt-2 text-muted-foreground text-xs">
            {card.author} · {card.readingTime} min read
          </p>
        </div>
      );
    case "product":
      return (
        <div className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-muted-foreground text-xs">
            <Package className="size-3.5" />
            {card.domain}
          </div>
          <p className="font-medium text-base leading-snug">{card.title}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{card.brand}</span>
            <span className="font-semibold text-sm">{card.price}</span>
          </div>
        </div>
      );
  }
}
