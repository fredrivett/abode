/**
 * Whether an error is a failed code-split chunk download (a dropped
 * connection, or a stale tab after a deploy). Re-rendering can't recover
 * from one: the failed import is cached, so only a fresh load helps.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "ChunkLoadError") return true;
  // Webpack names it; Turbopack and CSS chunks only say so in the message
  return /Loading (CSS )?chunk \S+ failed|Failed to load chunk/i.test(
    error.message,
  );
}
