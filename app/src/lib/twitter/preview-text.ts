import type { TwitterDetails } from "@/components/twitter/types";

/**
 * The text a media-less tweet card shows: the tweet's text, else an X Article's
 * title (an Article post's own text is just its link). Shared by the card and
 * its height estimate so the two agree.
 */
export function tweetPreviewText(
  details: Pick<TwitterDetails, "text" | "card">,
): string | null {
  if (details.text) return details.text;
  return details.card?.type === "article" ? details.card.title || null : null;
}
