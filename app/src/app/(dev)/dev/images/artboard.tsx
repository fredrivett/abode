"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CardBody,
  faceClass,
  faceStyle,
} from "@/app/(marketing)/_components/gallery-card";
import { GALLERY_CARDS } from "@/app/(marketing)/_components/gallery-data";
import { Highlight } from "@/app/(marketing)/_components/highlight";
import { cn } from "@/lib/utils";
import type { CardConfig, Design } from "./design";
import { getFormat } from "./formats";

type Drag = { id: string; px: number; py: number; x: number; y: number };

// Room left for the toolbar and buttons when fitting tall canvases on screen
const PREVIEW_CHROME_PX = 160;

/** The composed image: gallery cards behind the hero headline */
export function Artboard({
  design,
  scale = 1,
  selectedId,
  onSelect,
  onMove,
}: {
  design: Design;
  scale?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const dragRef = useRef<Drag | null>(null);
  const editable = Boolean(onSelect && onMove);
  const guide = getFormat(design.format).guide;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, card: CardConfig) => {
    if (!editable) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // preventScroll: focusing a card that overhangs the clipped artboard would
    // otherwise scroll the whole scene to reveal it
    e.currentTarget.focus({ preventScroll: true });
    onSelect?.(card.id);
    dragRef.current = {
      id: card.id,
      px: e.clientX,
      py: e.clientY,
      x: card.x,
      y: card.y,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    onMove?.(
      drag.id,
      Math.round(drag.x + (e.clientX - drag.px) / scale),
      Math.round(drag.y + (e.clientY - drag.py) / scale),
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, card: CardConfig) => {
    const step = e.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    onMove?.(card.id, card.x + d[0], card.y + d[1]);
  };

  return (
    <div
      className="relative overflow-clip bg-background"
      style={{ width: design.width, height: design.height }}
    >
      <div className="absolute inset-0 z-0">
        {design.cards.map((c) => {
          const card = GALLERY_CARDS.find((g) => g.id === c.id);
          if (!card || !c.visible) return null;
          const tileless = card.kind === "book" && !design.bookTile;
          return (
            // biome-ignore lint/a11y/useSemanticElements: draggable canvas item wrapping rich card markup (a <button> can't hold it)
            <div
              key={c.id}
              role="button"
              tabIndex={editable ? 0 : -1}
              onPointerDown={(e) => onPointerDown(e, c)}
              onPointerMove={onPointerMove}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onKeyDown={(e) => onKeyDown(e, c)}
              className={cn(
                faceClass(card),
                "absolute top-0 left-0 outline-none",
                tileless && "bg-none shadow-none",
                editable && "cursor-grab select-none active:cursor-grabbing",
                c.id === selectedId &&
                  "ring-2 ring-sky-500 ring-offset-2 ring-offset-background",
              )}
              style={{
                ...faceStyle(card),
                width: design.cardWidth,
                transformOrigin: "top left",
                transform: `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.scale}) rotate(${c.rot}deg)`,
                filter: c.blur > 0 ? `blur(${c.blur}px)` : undefined,
                zIndex: c.z,
              }}
            >
              <div className="pointer-events-none contents">
                <CardBody card={card} />
              </div>
              {c.fade > 0 && !tileless && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-background"
                  style={{ opacity: c.fade }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-center [text-shadow:0_1px_3px_rgba(255,255,255,0.9),0_4px_28px_rgba(255,255,255,0.7)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_4px_28px_rgba(0,0,0,0.7)]"
        style={{ transform: `translate(${design.textX}px, ${design.textY}px)` }}
      >
        <h1
          className="text-balance font-serif leading-[1.05] tracking-tight"
          style={{ fontSize: design.headlineSize, maxWidth: design.textWidth }}
        >
          your home should be{" "}
          {design.highlight ? <Highlight>yours.</Highlight> : "yours."}
        </h1>
        {design.showTagline && (
          <p
            className="text-balance font-medium text-foreground"
            style={{
              fontSize: design.taglineSize,
              marginTop: design.taglineGap,
              maxWidth: design.textWidth,
            }}
          >
            save everything. sort nothing. own it all.
          </p>
        )}
      </div>

      {editable && guide && design.showGuide && (
        <div
          title={guide.label}
          className={cn(
            "pointer-events-none absolute z-20 border-2 border-sky-500 border-dashed bg-sky-500/10",
            guide.shape === "circle" ? "rounded-full" : "rounded-md",
          )}
          style={{
            left: guide.left,
            top: guide.top,
            width: guide.width,
            height: guide.height,
          }}
        />
      )}
    </div>
  );
}

/** Fits a fixed-size artboard to the available width and viewport height */
export function ScaledPreview({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: (scale: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const maxHeight = window.innerHeight - PREVIEW_CHROME_PX;
      setScale(Math.min(1, el.clientWidth / width, maxHeight / height));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [width, height]);

  return (
    <div ref={ref} className="w-full">
      <div
        className="overflow-clip rounded-lg border shadow-sm"
        style={{ width: width * scale, height: height * scale }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          {children(scale)}
        </div>
      </div>
    </div>
  );
}
