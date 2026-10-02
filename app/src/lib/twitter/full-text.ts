import { safeFetch } from "@/lib/http/safe-fetch";

/**
 * X's syndication API (what react-tweet's `fetchTweet` calls) cuts a long post
 * (a "note tweet", > 280 chars) to ~280 chars and only flags it via
 * `note_tweet` — the full text isn't in the payload. FxTwitter's public API
 * returns it, so we ask it for the text of flagged posts.
 *
 * Optional, keyless and best-effort: any failure returns null and the caller
 * keeps the truncated text (rendered with a "Show more on X" link).
 */
const FXTWITTER_API_BASE = "https://api.fxtwitter.com";
const FXTWITTER_TIMEOUT_MS = 8_000;
const FXTWITTER_MAX_BYTES = 2 * 1024 * 1024;
// FxTwitter asks API consumers to identify themselves
const USER_AGENT = "abode (+https://github.com/fredrivett/abode)";

type FetchFn = (url: string) => Promise<Response>;

type FxTwitterStatus = { tweet: { id: string; text: string } };

function isFxTwitterStatus(value: unknown): value is FxTwitterStatus {
  if (typeof value !== "object" || value === null || !("tweet" in value)) {
    return false;
  }
  const { tweet } = value;
  return (
    typeof tweet === "object" &&
    tweet !== null &&
    "id" in tweet &&
    typeof tweet.id === "string" &&
    "text" in tweet &&
    typeof tweet.text === "string"
  );
}

const defaultFetch: FetchFn = (url) =>
  safeFetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    timeoutMs: FXTWITTER_TIMEOUT_MS,
    maxBytes: FXTWITTER_MAX_BYTES,
  });

/**
 * The full text of a long post, or null when FxTwitter can't supply one that
 * extends the truncated text we already have. Throws on network/HTTP errors so
 * the caller decides how to log/report them.
 */
export async function fetchFullTweetText(
  { tweetId, truncatedText }: { tweetId: string; truncatedText: string | null },
  fetchFn: FetchFn = defaultFetch,
): Promise<string | null> {
  const res = await fetchFn(
    `${FXTWITTER_API_BASE}/status/${encodeURIComponent(tweetId)}`,
  );
  if (!res.ok) {
    throw new Error(`FxTwitter responded ${res.status} for tweet ${tweetId}`);
  }

  const body: unknown = await res.json();
  if (!isFxTwitterStatus(body) || body.tweet.id !== tweetId) return null;

  const text = body.tweet.text.trim();
  // Only an upgrade counts: a shorter/empty text means FxTwitter didn't get the
  // note either, and the truncated syndication text is still the better copy
  if (!text || text.length <= (truncatedText?.trim().length ?? 0)) return null;
  return text;
}
