import { debugTrace, type TraceData } from "./trace";

/**
 * Describe how the query string changed between two URLs — the bit that
 * matters for URL-driven UI like the `?item=` dialog (e.g. a search write that
 * silently drops `item`).
 */
export function diffSearchParams({ from, to }: { from: string; to: string }): {
  added: string[];
  removed: string[];
  changed: string[];
} {
  const before = new URLSearchParams(from);
  const after = new URLSearchParams(to);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const key of new Set(before.keys())) {
    if (!after.has(key)) removed.push(key);
    else if (before.getAll(key).join() !== after.getAll(key).join()) {
      changed.push(key);
    }
  }
  for (const key of new Set(after.keys())) {
    if (!before.has(key)) added.push(key);
  }
  return { added, removed, changed };
}

/**
 * Short call-site stack for a history write: drops the "Error" header and the
 * wrapper's own frame so the first line is whoever called pushState/replaceState.
 */
export function callerStack(stack: string | undefined, depth = 6): string[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "Error")
    .slice(1, depth + 1);
}

function describeUrl(url: string | URL | null | undefined): {
  path: string;
  search: string;
} {
  const resolved = new URL(url ?? window.location.href, window.location.href);
  return { path: resolved.pathname, search: resolved.search };
}

function traceUrlChange({
  event,
  fromHref,
  toUrl,
  stack,
}: {
  event: string;
  fromHref: string;
  toUrl: string | URL | null | undefined;
  stack?: string;
}) {
  const from = describeUrl(fromHref);
  const to = describeUrl(toUrl);
  const params = diffSearchParams({ from: from.search, to: to.search });
  const data: TraceData = {
    from: `${from.path}${from.search}`,
    to: `${to.path}${to.search}`,
  };
  if (params.added.length) data.added = params.added;
  if (params.removed.length) data.removed = params.removed;
  if (params.changed.length) data.changed = params.changed;
  if (stack !== undefined) data.stack = callerStack(stack);
  debugTrace("url", event, data);
}

/**
 * Wrap history.pushState/replaceState and listen for popstate so every URL
 * change is on the timeline with a call stack. Returns an uninstall function.
 */
export function instrumentHistory(): () => void {
  const originalPush = window.history.pushState;
  const originalReplace = window.history.replaceState;
  // The URL as of the last change we saw
  let lastHref = window.location.href;

  // A back/forward traversal moves the URL without going through our wrapper.
  // Report it from whichever hook notices first — popstate, or a router
  // re-writing the new URL (Next does this from the Navigation API's navigate
  // event, before popstate fires)
  const syncTraversal = () => {
    if (window.location.href === lastHref) return;
    traceUrlChange({
      event: "popstate",
      fromHref: lastHref,
      toUrl: window.location.href,
    });
    lastHref = window.location.href;
  };

  const wrap =
    (
      event: "pushState" | "replaceState",
      original: History["pushState"],
    ): History["pushState"] =>
    (data, unused, url) => {
      syncTraversal();
      const fromHref = window.location.href;
      original.call(window.history, data, unused, url);
      lastHref = window.location.href;
      // Next's router re-replaces the same URL to stash its own state; skip that noise
      if (event === "replaceState" && lastHref === fromHref) return;
      traceUrlChange({
        event,
        fromHref,
        toUrl: url,
        stack: new Error().stack,
      });
    };

  const patchedPush = wrap("pushState", originalPush);
  const patchedReplace = wrap("replaceState", originalReplace);
  window.history.pushState = patchedPush;
  window.history.replaceState = patchedReplace;
  window.addEventListener("popstate", syncTraversal);

  return () => {
    // Only restore if nobody wrapped on top of us since
    if (window.history.pushState === patchedPush) {
      window.history.pushState = originalPush;
    }
    if (window.history.replaceState === patchedReplace) {
      window.history.replaceState = originalReplace;
    }
    window.removeEventListener("popstate", syncTraversal);
  };
}
