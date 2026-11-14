"use client";

import { useEffect, useState } from "react";
import {
  type FaviconTone,
  loadFaviconTone,
  settledFaviconTone,
} from "@/lib/favicon-tone";

/**
 * The favicon's tone (see {@link FaviconTone}), or null until it's measured
 * and when it reads on both themes. One measured earlier in the session is
 * returned on the first render. Put it on the wrapper as `data-tone` with
 * `FAVICON_BACKDROP_CLASS`.
 */
export function useFaviconTone(
  src: string | null | undefined,
): FaviconTone | null {
  const [measured, setMeasured] = useState<{
    src: string;
    tone: FaviconTone | null;
  } | null>(null);

  useEffect(() => {
    if (!src || settledFaviconTone(src) !== undefined) return;
    let cancelled = false;
    void loadFaviconTone(src).then((tone) => {
      if (!cancelled) setMeasured({ src, tone });
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src) return null;
  if (measured && measured.src === src) return measured.tone;
  return settledFaviconTone(src) ?? null;
}
