"use client";

import { Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { FilterChip } from "@/components/search/filter-chip";
import type { Filter, FilterType } from "@/lib/search/types";
import { useDemoSearch } from "./demo-search-context";
import {
  DEMO_SEARCHES,
  type DemoSearch,
  type DemoToken,
  matchesForTokens,
} from "./demo-searches";

// Chips render via the app's real FilterChip so the homepage and product stay
// visually identical. Queries + which cards they surface live in demo-searches.
type Token = DemoToken;

// Each frame carries the cards surfaced by the tokens committed so far, so the
// gallery filters live as the query is built (see matchesForTokens).
type Frame = {
  committed: Token[];
  typing: string;
  duration: number;
  activeMatchIds?: string[];
};

const TYPE_MS = 55;
const DELETE_MS = 30;
const WORD_PAUSE_MS = 140;
const COMMIT_MS = 60;
const CHIP_POP_MS = 130;
const QUERY_HOLD_MS = 1600;
const EMPTY_PAUSE_MS = 320;

// Precompute the whole cycle as timed frames: type each token char by char,
// commit it (chips pop), hold the full query, then backspace it away.
function buildFrames(search: DemoSearch): Frame[] {
  const frames: Frame[] = [];
  const committed: Token[] = [];
  // Recomputed only when `committed` changes (a chip pops or is deleted) and the
  // same reference is reused for every frame in between, so the gallery re-reads
  // matches on commit boundaries rather than on every typed character.
  let matches = matchesForTokens(committed) ?? undefined;
  const snap = (typing: string, duration: number) =>
    frames.push({
      committed: [...committed],
      typing,
      duration,
      activeMatchIds: matches,
    });

  for (const token of search.tokens) {
    const full = token.kind === "chip" ? token.value : token.text;
    for (let i = 1; i <= full.length; i++) snap(full.slice(0, i), TYPE_MS);
    snap(full, WORD_PAUSE_MS);
    committed.push(token);
    matches = matchesForTokens(committed) ?? undefined;
    snap("", token.kind === "chip" ? CHIP_POP_MS : COMMIT_MS);
  }

  // Hold the fully-typed query — the narrowed-down matches rest on screen.
  snap("", QUERY_HOLD_MS);

  while (committed.length > 0) {
    const last = committed[committed.length - 1];
    committed.pop();
    matches = matchesForTokens(committed) ?? undefined;
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

// static state shown when the visitor prefers reduced motion — the first query,
// fully typed, with its matches already surfaced
const STATIC_FRAME: Frame = {
  committed: DEMO_SEARCHES[0].tokens,
  typing: "",
  duration: 0,
  activeMatchIds: matchesForTokens(DEMO_SEARCHES[0].tokens) ?? undefined,
};

export function SearchDemo() {
  const frames = useMemo(() => DEMO_SEARCHES.flatMap(buildFrames), []);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const { setActiveMatchIds } = useDemoSearch();

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

  // Surface the held query's matches to the gallery (null between queries).
  const activeMatchIds = frame.activeMatchIds ?? null;
  useEffect(() => {
    setActiveMatchIds(activeMatchIds);
  }, [activeMatchIds, setActiveMatchIds]);

  return (
    <div className="mx-auto w-full max-w-md">
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
                  className="mx-0.75"
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
        Search abode in plain language — for example: blue computer; vinyl;
        articles on startups; london 2024.
      </span>
    </div>
  );
}
