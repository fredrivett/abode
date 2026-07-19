"use client";

import { Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { type FilterType, getFilterColorClass } from "@/lib/search/types";
import { cn } from "@/lib/utils";

// A token is either plain typed text or a value that maps to a real facet
// (and so pops into a chip on "space"). Only genuine facet values tag-ify —
// connective words stay as text. This mirrors the product's tinting via
// getFilterColorClass; the "emoji + value" chip look is a homepage flourish.
type Token =
  | { kind: "text"; text: string }
  | { kind: "chip"; facet: FilterType; value: string };

const QUERIES: Token[][] = [
  [
    { kind: "chip", facet: "color", value: "orange" },
    { kind: "text", text: "armchair" },
  ],
  [
    { kind: "chip", facet: "location", value: "paris" },
    { kind: "text", text: "trip" },
    { kind: "chip", facet: "date", value: "june 2026" },
  ],
  [
    { kind: "text", text: "essays on" },
    { kind: "chip", facet: "tag", value: "typography" },
  ],
];

// colour chips get a swatch; every other facet shows its emoji
const FACET_EMOJI: Partial<Record<FilterType, string>> = {
  type: "✳️",
  tag: "🏷️",
  object: "📦",
  source: "🔗",
  date: "📅",
  location: "📍",
};

type Frame = { committed: Token[]; typing: string; duration: number };

const TYPE_MS = 55;
const DELETE_MS = 30;
const WORD_PAUSE_MS = 140;
const CHIP_POP_MS = 130;
const QUERY_HOLD_MS = 1600;
const EMPTY_PAUSE_MS = 320;

function buildFrames(query: Token[]): Frame[] {
  const frames: Frame[] = [];
  const committed: Token[] = [];

  for (const token of query) {
    const full = token.kind === "chip" ? token.value : token.text;
    for (let i = 1; i <= full.length; i++) {
      frames.push({
        committed: [...committed],
        typing: full.slice(0, i),
        duration: TYPE_MS,
      });
    }
    frames.push({
      committed: [...committed],
      typing: full,
      duration: WORD_PAUSE_MS,
    });
    committed.push(token);
    frames.push({
      committed: [...committed],
      typing: "",
      duration: token.kind === "chip" ? CHIP_POP_MS : 60,
    });
  }

  frames.push({
    committed: [...committed],
    typing: "",
    duration: QUERY_HOLD_MS,
  });

  while (committed.length > 0) {
    const last = committed[committed.length - 1];
    const rest = committed.slice(0, -1);
    if (last.kind === "text") {
      for (let i = last.text.length - 1; i >= 0; i--) {
        frames.push({
          committed: [...rest],
          typing: last.text.slice(0, i),
          duration: DELETE_MS,
        });
      }
    } else {
      frames.push({ committed: [...rest], typing: "", duration: CHIP_POP_MS });
    }
    committed.pop();
  }

  frames.push({ committed: [], typing: "", duration: EMPTY_PAUSE_MS });
  return frames;
}

function FacetChip({ facet, value }: { facet: FilterType; value: string }) {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 align-middle font-medium text-[0.9em] leading-none",
        getFilterColorClass(facet),
      )}
    >
      {facet === "color" ? (
        <span
          className="size-3 rounded-sm border border-current/25"
          style={{ backgroundColor: value }}
        />
      ) : (
        <span aria-hidden>{FACET_EMOJI[facet]}</span>
      )}
      {value}
    </span>
  );
}

function renderToken(token: Token, index: number) {
  if (token.kind === "text") return <span key={index}>{token.text}</span>;
  return <FacetChip key={index} facet={token.facet} value={token.value} />;
}

// static state shown when the visitor prefers reduced motion
const STATIC_FRAME: Frame = { committed: QUERIES[0], typing: "", duration: 0 };

export function SearchDemo() {
  const frames = useMemo(() => QUERIES.flatMap(buildFrames), []);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(
      () => setIndex((prev) => (prev + 1) % frames.length),
      frames[index].duration,
    );
    return () => clearTimeout(timer);
  }, [index, frames, reducedMotion]);

  const frame = reducedMotion ? STATIC_FRAME : frames[index];

  return (
    <div className="mx-auto w-full max-w-xl">
      <div
        aria-hidden
        className="flex h-14 items-center gap-2.5 overflow-hidden rounded-xl border border-border bg-muted/30 px-4 text-left text-foreground text-lg shadow-sm"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 whitespace-nowrap">
          {frame.committed.map((token, i) => (
            <Fragment
              key={
                token.kind === "chip"
                  ? `${token.facet}:${token.value}`
                  : `text:${token.text}`
              }
            >
              {i > 0 && " "}
              {renderToken(token, i)}
            </Fragment>
          ))}
          {frame.typing && frame.committed.length > 0 ? " " : null}
          {frame.typing}
          {!reducedMotion && (
            <span className="ml-px inline-block h-[1.15em] w-0.5 animate-pulse bg-foreground/70 align-middle" />
          )}
        </span>
      </div>
      <span className="sr-only">
        Search abode in plain language — for example: orange armchair; paris
        trip june 2026; essays on typography.
      </span>
    </div>
  );
}
