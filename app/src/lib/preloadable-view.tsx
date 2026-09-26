"use client";

import {
  type ComponentType,
  lazy,
  type ReactNode,
  Suspense,
  useState,
  useSyncExternalStore,
} from "react";

const subscribeNoop = () => () => {};

export type PreloadableView<P extends object> = ComponentType<P> & {
  /** Start loading the component's chunk; resolves once it's ready. */
  preload: () => Promise<unknown>;
};

/**
 * A client-only lazily-loaded component (like `next/dynamic` with
 * `ssr: false`) that can be preloaded — and, once loaded, renders directly
 * with no Suspense boundary.
 *
 * `next/dynamic` goes through `React.lazy`, which suspends on its first render
 * even when the chunk is already in memory, and React then holds a committed
 * fallback for its ~300ms throttle. So preloading alone can't stop the
 * "Loading" flash on first use; skipping Suspense for an already-loaded
 * component does. Each instance keeps whichever path it mounted with, so a
 * load finishing mid-life never swaps (remounts) its subtree.
 */
export function preloadableView<P extends object>(
  loader: () => Promise<ComponentType<P>>,
  options: { loading?: () => ReactNode } = {},
): PreloadableView<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;

  // React.lazy caches its promise for good — including a rejection — so a
  // failed load (e.g. a transient chunk error) gets a fresh wrapper, letting a
  // later render retry instead of rethrowing forever
  const createLazy = () =>
    lazy(() => preload().then((component) => ({ default: component })));
  let Lazy = createLazy();

  const preload = () => {
    pending ??= loader().then(
      (component) => {
        loaded = component;
        return component;
      },
      (error: unknown) => {
        pending = null;
        Lazy = createLazy();
        throw error;
      },
    );
    return pending;
  };

  function View(props: P) {
    // Client-only: the server (and the hydration render) show the fallback
    const isClient = useSyncExternalStore(
      subscribeNoop,
      () => true,
      () => false,
    );
    const [Loaded] = useState(() => loaded);
    const fallback = options.loading?.() ?? null;

    if (!isClient) return fallback;
    if (Loaded) return <Loaded {...props} />;
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  }

  return Object.assign(View, { preload });
}
