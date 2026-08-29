import { env } from "@/env.server";

/**
 * A Trigger.dev Runs dashboard link filtered to the given run tags, or `null`
 * when `TRIGGER_RUNS_DASHBOARD_URL` isn't set (degrades to "no link"). The base
 * URL carries the private org/project/env slugs, so it's config, not code — see
 * env.server.ts.
 *
 * @param tags run tags to filter by (OR-combined by the dashboard)
 * @param opts.period dashboard time window (e.g. "1d"); omit for the default
 * @param opts.rootOnly `false` to include child runs, not just top-level ones
 */
export function triggerRunsUrl(
  tags: string[],
  opts?: { period?: string; rootOnly?: boolean },
): string | null {
  const base = env.TRIGGER_RUNS_DASHBOARD_URL;
  if (!base) return null;

  const params = new URLSearchParams();
  for (const tag of tags) params.append("tags", tag);
  if (opts?.period) params.set("period", opts.period);
  if (opts?.rootOnly !== undefined) {
    params.set("rootOnly", String(opts.rootOnly));
  }

  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${params.toString()}`;
}
