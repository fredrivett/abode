import { Link2, Package, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { BookCover3D } from "@/components/book/book-cover-3d";
import { TwitterIcon } from "@/components/icons/platform-icons";
import { NoteCard } from "@/components/note/note-card";
import { BOOK_TILE_PADDING_X } from "@/lib/book-cover";
import { cn } from "@/lib/utils";
import type { GalleryCard } from "./gallery-data";

const BOX_CLASS =
  "relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

export const HOVER_BASE =
  "transition-[transform,translate,box-shadow] duration-300 ease-out";

// Books get the app's real 3D book treatment (BookCover3D) on a neutral tile,
// mirroring the dashboard grid — so the card carries its own surface/padding/
// aspect instead of the flat bordered box every other kind uses.
export function faceClass(card: GalleryCard) {
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

export function faceStyle(card: GalleryCard): CSSProperties | undefined {
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

export function hoverClass(card: GalleryCard) {
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

// --- the "understood" overlay — lifts forward off the card on hover ---

export function Intelligence({ card }: { card: GalleryCard }) {
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

export function CardBody({ card }: { card: GalleryCard }) {
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
