/**
 * Coalesces repeated `schedule()` calls into a single
 * `requestAnimationFrame`-deferred run of `callback`, with a `cancel()` for
 * cleanup.
 *
 * Used to defer layout work out of observer callbacks (Resize/Mutation):
 * measuring and updating state synchronously inside a `ResizeObserver` callback
 * reflows within the same delivery, which the browser reports as "ResizeObserver
 * loop completed with undelivered notifications". Deferring to the next frame
 * breaks that loop.
 */
export function coalesceFrame(callback: () => void): {
  schedule: () => void;
  cancel: () => void;
} {
  let frame = 0;
  return {
    schedule: () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(callback);
    },
    cancel: () => cancelAnimationFrame(frame),
  };
}
