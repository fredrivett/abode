"use client";

import { Link2, Package, Play } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { BookCover3D } from "@/components/book/book-cover-3d";
import { TwitterIcon } from "@/components/icons/platform-icons";
import { NoteCard } from "@/components/note/note-card";
import { BOOK_TILE_PADDING_X } from "@/lib/book-cover";
import { cn } from "@/lib/utils";
import { GALLERY_CARDS, type GalleryCard } from "./gallery-data";

const BOX_CLASS =
  "relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

const HOVER_BASE =
  "transition-[transform,translate,box-shadow] duration-300 ease-out";

// Books get the app's real 3D book treatment (BookCover3D) on a neutral tile,
// mirroring the dashboard grid — so the card carries its own surface/padding/
// aspect instead of the flat bordered box every other kind uses.
function faceClass(card: GalleryCard) {
  if (card.kind === "book") {
    return "relative flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-neutral-50 to-neutral-100 shadow-sm dark:from-neutral-900 dark:to-neutral-950";
  }
  // NoteCard brings its own border/bg/radius (via --grid-border-radius); the
  // tile positions it and carries the hover shadow. No fixed height, so the
  // note grows with its content. NoteCard's bottom clip-fade (aria-hidden) is
  // for fixed-height frames — pointless here (content never overflows) and it
  // would fade the last line, so hide it.
  if (card.kind === "note")
    return "relative rounded-2xl [&_[aria-hidden]]:hidden";
  return BOX_CLASS;
}

// The tile aspect derives from the app's book frame (2:3 cover inset by
// BOOK_TILE_PADDING → 1 / 1.46). The book itself is sized by an inner wrapper
// (see CardBody) rather than padding, so grid and fly render identically —
// % padding on the absolutely-positioned fly node would resolve against the
// fixed overlay, not the tile.
const BOOK_TILE_ASPECT = "1 / 1.46";
const BOOK_INNER_WIDTH = `${(1 - 2 * BOOK_TILE_PADDING_X) * 100}%`; // 68%

function faceStyle(card: GalleryCard): CSSProperties | undefined {
  if (card.kind === "book") {
    return { aspectRatio: BOOK_TILE_ASPECT };
  }
  // No fixed aspect — the note grows with its content. Just round NoteCard to
  // match the gallery (it reads --grid-border-radius, default 8px).
  if (card.kind === "note") {
    return { "--grid-border-radius": "16px" } as CSSProperties;
  }
  return undefined;
}

function hoverClass(card: GalleryCard) {
  // BookCover3D owns its own hover (the cover opens further), so the tile just
  // lifts — no competing rotateX/preserve-3d.
  if (card.kind === "book") {
    return cn(HOVER_BASE, "group-hover:-translate-y-1 group-hover:shadow-xl");
  }
  return cn(
    HOVER_BASE,
    "[transform-style:preserve-3d] group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:[transform:rotateX(5deg)]",
  );
}

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
          {objects.slice(0, 3).join(" · ")}
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

function CardBody({ card }: { card: GalleryCard }) {
  if (card.kind === "book") {
    // Inner wrapper sizes the book (68% of tile width, 2:3 cover) and the
    // tile's flex-centre supplies the surrounding margin — so no padding, and
    // grid vs fly render identically.
    return (
      <div className="aspect-[2/3]" style={{ width: BOOK_INNER_WIDTH }}>
        <BookCover3D src={card.cover} alt={card.title} />
      </div>
    );
  }
  if (card.kind === "note") {
    return <NoteCard title={card.title ?? null} content={card.body} />;
  }
  return <CardMedia card={card} />;
}

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
      // books render via BookCover3D in CardBody, never here
      return null;
    case "tweet":
      return (
        <div className="p-4">
          <TwitterIcon className="absolute top-3.5 right-3.5 size-4 text-foreground/70" />
          <div className="mb-2 flex items-center gap-2 pr-6">
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
      // notes render via NoteCard in CardBody, never here
      return null;
    case "article":
      return (
        <div>
          {/* og:image-style banner — a generated card preview of the essay */}
          <div className="flex aspect-[1.91/1] flex-col justify-between bg-gradient-to-br from-[#f6f1e7] to-[#e4dac4] p-4 text-neutral-900">
            <span className="font-medium text-[11px] text-neutral-500 uppercase tracking-widest">
              essay
            </span>
            <p className="font-semibold font-serif text-xl leading-tight">
              {card.title}
            </p>
            <span className="text-neutral-600 text-xs">{card.author}</span>
          </div>
          <div className="flex items-center gap-1.5 p-3 text-muted-foreground text-xs">
            <Link2 className="size-3.5 shrink-0" />
            <span className="truncate">
              {card.domain} · {card.readingTime} min read
            </span>
          </div>
        </div>
      );
    case "product":
      return (
        <div>
          {/* product shot on a light surface, like a store listing */}
          <div className="flex aspect-square items-center justify-center bg-gradient-to-b from-neutral-100 to-neutral-200 p-4">
            {/* biome-ignore lint/performance/noImgElement: static marketing asset */}
            <img
              src={card.image}
              alt={card.title}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
          <div className="p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground text-xs">
              <Package className="size-3.5 shrink-0" />
              {card.brand}
            </div>
            <p className="line-clamp-2 font-medium text-sm leading-snug">
              {card.title}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded bg-green-500/15 px-1.5 py-0.5 font-medium text-[11px] text-green-600 dark:text-green-400">
                in stock
              </span>
              <span className="font-semibold text-base">{card.price}</span>
            </div>
          </div>
        </div>
      );
  }
}
