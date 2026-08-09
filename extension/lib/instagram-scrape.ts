import { browser } from "wxt/browser";

export type InstagramScrapePayload = {
  postId: string;
  mediaType: "post" | "reel" | "tv";
  authorName: string | null;
  authorUsername: string;
  caption: string | null;
  likeCount: number | null;
  commentCount: number | null;
  media: Array<{ type: "photo"; url: string }>;
  coverMediaIndex: number;
};

/** Post shortcode + media type from an Instagram URL, or null if not a post. */
export function parseInstagramPost(
  url: string,
): { postId: string; mediaType: "post" | "reel" | "tv" } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "instagram.com" && !host.endsWith(".instagram.com")) return null;
  const m = parsed.pathname.match(
    /^\/(?:[^/]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)/i,
  );
  if (!m) return null;
  const seg = m[1].toLowerCase();
  const mediaType = seg === "tv" ? "tv" : seg.startsWith("reel") ? "reel" : "post";
  return { postId: m[2], mediaType };
}

/** Raw data pulled from the page DOM (the shape scrapeInPage returns). */
type PageData = {
  ogTitle: string | null;
  ogDescription: string | null;
  ogUrl: string | null;
  ogImage: string | null;
  imageUrls: string[];
};

/**
 * Injected via scripting.executeScript, so this MUST be fully self-contained
 * (no closures/imports) — it runs in the logged-in post page's own context.
 *
 * Reads the OG tags (present even in the logged-in SPA) for author/caption/cover
 * and collects the post's content images from the rendered DOM. Instagram
 * lazy-loads carousel slides, so this sees what's currently rendered; advancing
 * the carousel to capture every slide is a follow-up.
 */
function scrapeInPage(): {
  ogTitle: string | null;
  ogDescription: string | null;
  ogUrl: string | null;
  ogImage: string | null;
  imageUrls: string[];
} {
  const meta = (p: string) =>
    document.querySelector(`meta[property="${p}"]`)?.getAttribute("content") ??
    null;

  const urls = new Set<string>();
  const imgs = document.querySelectorAll("article img, [role='dialog'] img");
  for (const el of Array.from(imgs)) {
    const img = el as HTMLImageElement;
    const src = img.currentSrc || img.src;
    if (!src || !/cdninstagram|scontent/.test(src)) continue;
    // Skip avatars/thumbnails — post media renders large.
    if (img.naturalWidth && img.naturalWidth < 320) continue;
    urls.add(src);
  }
  const ogImage = meta("og:image");
  if (ogImage) urls.add(ogImage);

  return {
    ogTitle: meta("og:title"),
    ogDescription: meta("og:description"),
    ogUrl: meta("og:url"),
    ogImage,
    imageUrls: [...urls],
  };
}

function parseCount(s: string): number | null {
  const n = Number.parseInt(s.replace(/,/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

/** Combine the URL-derived post id with the scraped page data into a payload. */
export function buildScrapePayload(
  post: { postId: string; mediaType: "post" | "reel" | "tv" },
  page: PageData,
): InstagramScrapePayload | null {
  if (page.imageUrls.length === 0) return null;

  // Username from the canonical og:url, else the "- <username> on" fragment.
  const authorUsername =
    page.ogUrl?.match(/instagram\.com\/([^/]+)\/(?:p|reels?|tv)\//i)?.[1] ??
    page.ogDescription?.match(/-\s*([A-Za-z0-9_.]+)\s+on\b/)?.[1] ??
    null;
  if (!authorUsername) return null;

  const authorName =
    page.ogTitle?.match(/^(.*?)\s+on Instagram/i)?.[1]?.trim() || null;
  const caption =
    page.ogTitle
      ?.match(/on Instagram:\s*(.*)$/i)?.[1]
      ?.replace(/^["“]|["”]$/g, "")
      .trim() || null;
  const counts = page.ogDescription?.match(
    /([\d,]+)\s+likes?,\s+([\d,]+)\s+comments?/i,
  );

  return {
    postId: post.postId,
    mediaType: post.mediaType,
    authorName,
    authorUsername,
    caption,
    likeCount: counts ? parseCount(counts[1]) : null,
    commentCount: counts ? parseCount(counts[2]) : null,
    media: page.imageUrls.map((url) => ({ type: "photo" as const, url })),
    coverMediaIndex: page.ogImage
      ? Math.max(0, page.imageUrls.indexOf(page.ogImage))
      : 0,
  };
}

/**
 * Scrape an Instagram post from a tab the user just acted on. `activeTab` grants
 * the access this needs (no instagram.com host-permission prompt), so it only
 * works right after a user gesture on that tab. Returns null when the tab isn't
 * a post or nothing usable was found — the caller falls back to a plain URL save.
 */
export async function scrapeInstagramTab(
  tabId: number,
  url: string,
): Promise<InstagramScrapePayload | null> {
  const post = parseInstagramPost(url);
  if (!post) return null;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: scrapeInPage,
    });
    const page = injection?.result as PageData | undefined;
    if (!page) return null;
    return buildScrapePayload(post, page);
  } catch {
    return null;
  }
}
