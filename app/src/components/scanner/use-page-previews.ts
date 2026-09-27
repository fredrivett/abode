"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLogger } from "@/lib/logger.client";
import type { ScanFilter } from "@/lib/scanner/filters";
import type { ScanPage } from "@/lib/scanner/pages";
import { previewKey } from "@/lib/scanner/pages";
import type { RenderedPage, ScannerClient } from "@/lib/scanner/scanner-client";

const log = createLogger("scanner/use-page-previews");

export interface PagePreview {
  url: string;
  width: number;
  height: number;
}

export interface PreviewRequest {
  page: ScanPage;
  filter: ScanFilter;
}

/**
 * Renders (and caches as object URLs) the preview image for each requested
 * page + filter. Renders run one at a time in the scanner worker to bound
 * memory; previews no longer requested are revoked.
 */
export function usePagePreviews({
  client,
  requests,
}: {
  client: ScannerClient | null;
  requests: PreviewRequest[];
}) {
  const [previews, setPreviews] = useState<ReadonlyMap<string, PagePreview>>(
    () => new Map(),
  );
  const pending = useRef(new Set<string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const wanted = useRef(new Set<string>());

  const keyed = requests.map((request) => ({
    ...request,
    key: previewKey({ page: request.page, filter: request.filter }),
  }));
  const wantedSignature = keyed.map((request) => request.key).join("|");
  const latestRequests = useRef(keyed);
  latestRequests.current = keyed;
  const latestPreviews = useRef(previews);
  latestPreviews.current = previews;

  const store = useCallback((key: string, rendered: RenderedPage) => {
    const preview: PagePreview = {
      url: URL.createObjectURL(rendered.blob),
      width: rendered.width,
      height: rendered.height,
    };
    setPreviews((current) => {
      const previous = current.get(key);
      if (previous) URL.revokeObjectURL(previous.url);
      const next = new Map(current);
      next.set(key, preview);
      return next;
    });
  }, []);

  /** Adds an already-rendered preview (e.g. rendered ahead of a transition) */
  const seed = useCallback(
    ({
      page,
      filter,
      rendered,
    }: PreviewRequest & { rendered: RenderedPage }) => {
      store(previewKey({ page, filter }), rendered);
    },
    [store],
  );

  // Keyed on the signature so a re-render with the same pages is a no-op
  useEffect(() => {
    wanted.current = new Set(wantedSignature ? wantedSignature.split("|") : []);

    setPreviews((current) => {
      const stale = [...current.keys()].filter(
        (key) => !wanted.current.has(key),
      );
      if (stale.length === 0) return current;
      const next = new Map(current);
      for (const key of stale) {
        URL.revokeObjectURL(current.get(key)?.url ?? "");
        next.delete(key);
      }
      return next;
    });

    if (!client) return;
    for (const { key, page, filter } of latestRequests.current) {
      if (pending.current.has(key) || latestPreviews.current.has(key)) continue;
      pending.current.add(key);
      queue.current = queue.current.then(async () => {
        try {
          if (!wanted.current.has(key)) return;
          const rendered = await client.render({
            source: page.source,
            quad: page.quad,
            rotation: page.rotation,
            filter,
          });
          if (wanted.current.has(key)) store(key, rendered);
        } catch (error) {
          log.warn({ error }, "Failed to render page preview");
        } finally {
          pending.current.delete(key);
        }
      });
    }
  }, [client, wantedSignature, store]);

  // Revoke everything on unmount
  useEffect(
    () => () => {
      for (const preview of latestPreviews.current.values()) {
        URL.revokeObjectURL(preview.url);
      }
    },
    [],
  );

  return { previews, seed };
}
