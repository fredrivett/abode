export const GITHUB_REPO = "fredrivett/abode";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

/**
 * Fetch the repo's GitHub star count, cached for an hour. Returns null when the
 * API is unavailable or the repo is private (so callers can degrade gracefully
 * to a plain "star on github" CTA without a count).
 */
export async function getGitHubStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

/** Compact star count, e.g. 1234 → "1.2k". */
export function formatStarCount(count: number): string {
  if (count < 1000) return `${count}`;
  return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}
