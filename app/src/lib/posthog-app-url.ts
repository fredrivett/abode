import { POSTHOG_HOST, POSTHOG_KEY } from "@/env";

// posthog-js ingests here when no api_host is configured
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * The PostHog app origin for an ingestion host. PostHog Cloud ingests at
 * `<region>.i.posthog.com` but serves the app at `<region>.posthog.com`; a
 * self-hosted PostHog serves both from the same origin.
 */
export function getPostHogAppOrigin(host: string): string | null {
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    return null;
  }
  url.hostname = url.hostname.replace(
    /^([a-z0-9-]+)\.i\.posthog\.com$/,
    "$1.posthog.com",
  );
  return url.origin;
}

/**
 * Link to a person's session recordings in PostHog, keyed by distinct ID (our
 * user ID — the browser client identifies with it). Without a project ID
 * PostHog opens the viewer's current project. Null when PostHog isn't set up.
 */
export function buildPostHogPersonReplaysUrl({
  distinctId,
  apiKey,
  host,
  projectId,
}: {
  distinctId: string;
  apiKey: string | undefined;
  host: string | undefined;
  projectId: string | undefined;
}): string | null {
  if (!apiKey) return null;
  const origin = getPostHogAppOrigin(host || DEFAULT_POSTHOG_HOST);
  if (!origin) return null;
  const projectPath = projectId
    ? `/project/${encodeURIComponent(projectId)}`
    : "";
  return `${origin}${projectPath}/person/${encodeURIComponent(distinctId)}#activeTab=sessionRecordings`;
}

/** `buildPostHogPersonReplaysUrl` for this deployment's PostHog config (server-side) */
export function getPostHogPersonReplaysUrl(distinctId: string): string | null {
  return buildPostHogPersonReplaysUrl({
    distinctId,
    apiKey: POSTHOG_KEY,
    host: POSTHOG_HOST,
    projectId: process.env.POSTHOG_PROJECT_ID,
  });
}
