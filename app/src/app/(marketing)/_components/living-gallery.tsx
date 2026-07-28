"use client";

import { FileText, Link2, Package, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { GALLERY_CARDS, type GalleryCard } from "./gallery-data";

// Deterministic per-card drift so the gallery "breathes" without a random()
// call (which would differ between server and client). Varied duration, delay
// and amplitude keep neighbouring cards out of sync — the whole wall feels alive.
function driftStyle(index: number): CSSProperties {
  const duration = 6.5 + (index % 4); // 6.5–9.5s
  const delay = -((index * 1.3) % 5); // stagger, already mid-cycle
  const amplitude = -(6 + (index % 4) * 2.5); // -6 to -13.5px
  return {
    animation: `gallery-drift ${duration}s ease-in-out ${delay}s infinite`,
    "--drift": `${amplitude}px`,
  } as CSSProperties;
}

export function LivingGallery() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <section className="w-full max-w-5xl px-4 py-24">
      <style>{`@keyframes gallery-drift { 50% { transform: translateY(var(--drift, -10px)); } }`}</style>

      <div className="mx-auto max-w-xl text-center">
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

      <ul className="mt-14 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4">
        {GALLERY_CARDS.map((card, i) => (
          <li
            key={card.id}
            className="group relative break-inside-avoid [perspective:1200px]"
            style={reducedMotion ? undefined : driftStyle(i)}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
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
