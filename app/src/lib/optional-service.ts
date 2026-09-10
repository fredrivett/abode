/**
 * Run one optional-service enhancement with the graceful-degradation contract
 * baked into its shape (see "Optional Services & Graceful Degradation" in
 * AGENTS.md / CLAUDE.md). Three outcomes, one each:
 *
 * 1. **Not configured → skip cleanly.** `onSkip()` supplies the fallback; `run`
 *    is never invoked, so no setup work (signed URLs, client init, fetches)
 *    happens for a service we're skipping (rule 4).
 * 2. **Configured + succeeds →** the value from `run()`.
 * 3. **Configured + throws → catch and continue.** `onError(error)` supplies the
 *    fallback; the throw never escapes, so one optional enhancement failing can't
 *    fail the surrounding work (rule 3). Put `captureServerException` /
 *    `reportImageEmbeddingFailure` and any `warn` log inside `onError`.
 *
 * This is for genuinely-optional enhancements whose failure must be swallowed.
 * It is deliberately NOT for work that should fail-and-retry on error (e.g. a
 * recommended-core vision pass) — those want a bare `if (!configured) skip`
 * with the error left to propagate, not a catch-all.
 */
export type OptionalServiceOptions<T> = {
  /** Whether the service's key/config is present. A boolean or a predicate. */
  isConfigured: boolean | (() => boolean);
  /** Work to run when configured. May throw/reject — routed to `onError`. */
  run: () => Promise<T> | T;
  /** Fallback when the service isn't configured (skip-clean). */
  onSkip: () => T;
  /** Fallback when configured but `run` failed (catch-and-continue). */
  onError: (error: unknown) => T;
};

export async function withOptionalService<T>(
  options: OptionalServiceOptions<T>,
): Promise<T> {
  const { isConfigured, run, onSkip, onError } = options;

  const configured =
    typeof isConfigured === "function" ? isConfigured() : isConfigured;
  if (!configured) return onSkip();

  try {
    return await run();
  } catch (error) {
    return onError(error);
  }
}
