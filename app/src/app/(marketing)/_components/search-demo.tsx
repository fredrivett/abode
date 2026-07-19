"use client";

import { Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { FilterChip } from "@/components/search/filter-chip";
import type { Filter, FilterType } from "@/lib/search/types";

// A token is either plain typed text or a value that maps to a real facet
// (and so pops into a chip on "space"). Only genuine facet values tag-ify —
// connective words stay as text. Chips render via the app's real FilterChip,
// so the homepage and product stay visually identical.
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
    // real ItemKind is "article"; shown plural (label-less) so it reads naturally
    { kind: "chip", facet: "type", value: "articles" },
    { kind: "text", text: "on" },
    { kind: "chip", facet: "tag", value: "typography" },
  ],
];

type Frame = { committed: Token[]; typing: string; duration: number };

const TYPE_MS = 55;
const DELETE_MS = 30;
const WORD_PAUSE_MS = 140;
const COMMIT_MS = 60;
const CHIP_POP_MS = 130;
const QUERY_HOLD_MS = 1600;
const EMPTY_PAUSE_MS = 320;

// Precompute the whole cycle as timed frames: type each token char by char,
// commit it (chips pop), hold the full query, then backspace it away.
function buildFrames(query: Token[]): Frame[] {
  const frames: Frame[] = [];
  const committed: Token[] = [];
  const snap = (typing: string, duration: number) =>
    frames.push({ committed: [...committed], typing, duration });

  for (const token of query) {
    const full = token.kind === "chip" ? token.value : token.text;
    for (let i = 1; i <= full.length; i++) snap(full.slice(0, i), TYPE_MS);
    snap(full, WORD_PAUSE_MS);
    committed.push(token);
    snap("", token.kind === "chip" ? CHIP_POP_MS : COMMIT_MS);
  }

  snap("", QUERY_HOLD_MS);

  while (committed.length > 0) {
    const last = committed[committed.length - 1];
    committed.pop();
    if (last.kind === "text") {
      for (let i = last.text.length - 1; i >= 0; i--) {
        snap(last.text.slice(0, i), DELETE_MS);
      }
    } else {
      snap("", CHIP_POP_MS);
    }
  }

  snap("", EMPTY_PAUSE_MS);
  return frames;
}

// sizing/alignment tweaks so the shared FilterChip sits inline in the typed query
const CHIP_CLASS =
  "-top-0.5 relative mx-0.5 px-1.5 py-0.5 align-middle text-[0.9em] leading-none";

const toFilter = (facet: FilterType, value: string): Filter => ({
  id: `${facet}:${value}`,
  type: facet,
  value,
  negated: false,
});

const tokenKey = (token: Token) =>
  token.kind === "chip"
    ? `${token.facet}:${token.value}`
    : `text:${token.text}`;

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
            <Fragment key={tokenKey(token)}>
              {i > 0 && " "}
              {token.kind === "text" ? (
                token.text
              ) : (
                <FilterChip
                  filter={toFilter(token.facet, token.value)}
                  className={CHIP_CLASS}
                />
              )}
            </Fragment>
          ))}
          {frame.typing && frame.committed.length > 0 ? " " : null}
          {frame.typing}
          {!reducedMotion && (
            <span className="-top-0.5 relative ml-px inline-block h-[1.15em] w-0.5 animate-pulse bg-foreground/70 align-middle" />
          )}
        </span>
      </div>
      <span className="sr-only">
        Search abode in plain language — for example: orange armchair; paris
        trip june 2026; articles on typography.
      </span>
    </div>
  );
}
