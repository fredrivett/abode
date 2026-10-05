import type {
  MediaDetails,
  QuotedTweet as RawQuotedTweet,
  Tweet,
  TweetBase,
} from "react-tweet/api";
import type { TwitterDetails, TwitterMedia } from "@/components/twitter/types";
import {
  type QuotedTweet,
  quotedTweetSchema,
  type TweetPoll,
  type TweetReplyContext,
  tweetPollSchema,
} from "./tweet-context";

/**
 * Turns X's embed (syndication) payload — fetched via react-tweet/api — into the
 * shape we store. Shared by capture and the tweet-context backfill.
 */

type RawBindingValue = {
  string_value?: string;
  boolean_value?: boolean;
  image_value?: { url?: string };
};

type RawCard = {
  name?: string;
  url?: string;
  binding_values?: Record<string, RawBindingValue>;
};

type RawArticle = {
  rest_id?: string;
  title?: string;
  preview_text?: string;
  cover_media?: { media_info?: { original_img_url?: string } };
};

// The payload carries fields react-tweet's types leave out
export type RawTweet = Tweet & { card?: RawCard; article?: RawArticle };

type TweetTextSource = Pick<
  TweetBase,
  "text" | "display_text_range" | "entities"
>;

const ARTICLE_URL = /\/i\/article\/\d+/;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * The tweet's text as X displays it: only the `display_text_range` (dropping
 * leading reply @mentions and the trailing t.co link to attached media), with
 * t.co links expanded to their real URLs and X's HTML escaping decoded.
 * `dropUrl` removes links that render as something else (an Article card, the
 * quoted tweet). Returns null when nothing is left.
 */
export function normalizeTweetText(
  tweet: TweetTextSource,
  { dropUrl }: { dropUrl?: (expandedUrl: string) => boolean } = {},
): string | null {
  if (!tweet.text) return null;
  // Entity indices count code points, so slice an Array.from, not the string
  const chars = Array.from(tweet.text);
  const [rangeStart, rangeEnd] = tweet.display_text_range ?? [0, chars.length];
  // The range is sometimes counted in UTF-16 units and overshoots into the
  // media link; clamp it the way react-tweet does
  const mediaStart = tweet.entities?.media?.[0]?.indices[0] ?? chars.length;
  const end = Math.min(rangeEnd, mediaStart, chars.length);

  const urls = [...(tweet.entities?.urls ?? [])]
    .filter(({ indices }) => indices[0] >= rangeStart && indices[1] <= end)
    .sort((a, b) => a.indices[0] - b.indices[0]);

  let text = "";
  let cursor = rangeStart;
  for (const url of urls) {
    text += chars.slice(cursor, url.indices[0]).join("");
    const expanded = url.expanded_url || url.url;
    if (!dropUrl?.(expanded)) text += expanded;
    cursor = url.indices[1];
  }
  text += chars.slice(cursor, end).join("");

  const normalized = decodeHtmlEntities(text).trim();
  return normalized.length > 0 ? normalized : null;
}

export function transformTweetMedia(
  mediaDetails: MediaDetails[] | undefined,
): TwitterMedia[] | null {
  if (!mediaDetails || mediaDetails.length === 0) return null;
  return mediaDetails.map((m): TwitterMedia => {
    const base: TwitterMedia = {
      type: m.type,
      url: m.media_url_https,
      width: m.original_info?.width,
      height: m.original_info?.height,
    };

    if ("video_info" in m && m.video_info) {
      base.posterUrl = m.media_url_https;
      base.variants = m.video_info.variants
        .filter((v) => v.content_type?.startsWith("video/"))
        .map((v) => ({
          type: v.content_type ?? "video/mp4",
          src: v.url,
          bitrate: v.bitrate,
        }));
    }

    return base;
  });
}

function articleUrl(article: RawArticle): string | null {
  return article.rest_id ? `https://x.com/i/article/${article.rest_id}` : null;
}

/**
 * The tweet's card: an X Article's preview (title, opening text, cover) when the
 * tweet is an Article, else a link card. X's embed data carries only an
 * Article's first ~200 characters, never its body.
 */
export function extractTweetCard(tweet: RawTweet): TwitterDetails["card"] {
  const { article } = tweet;
  if (article?.title) {
    const url = articleUrl(article);
    if (url) {
      return {
        type: "article",
        title: article.title,
        description: article.preview_text ?? "",
        url,
        imageUrl: article.cover_media?.media_info?.original_img_url ?? null,
      };
    }
  }

  if (!tweet.card) return null;
  const values = tweet.card.binding_values;
  const title = values?.title?.string_value;
  const description = values?.description?.string_value;
  if (!title && !description) return null;

  return {
    title: title ?? "",
    description: description ?? "",
    url: values?.url?.string_value ?? tweet.card.url ?? "",
    imageUrl:
      values?.thumbnail_image_large?.image_value?.url ??
      values?.thumbnail_image?.image_value?.url ??
      values?.player_image_large?.image_value?.url ??
      null,
  };
}

const POLL_CARD = /^poll\dchoice/;
const MAX_POLL_OPTIONS = 4;

/** A poll's options and vote counts, from its `poll<n>choice_*` card */
export function extractTweetPoll(tweet: RawTweet): TweetPoll | null {
  const { card } = tweet;
  if (!card?.name || !POLL_CARD.test(card.name)) return null;
  const values = card.binding_values ?? {};

  const options: TweetPoll["options"] = [];
  for (let i = 1; i <= MAX_POLL_OPTIONS; i++) {
    const label = values[`choice${i}_label`]?.string_value;
    if (!label) break;
    const votes = Number.parseInt(
      values[`choice${i}_count`]?.string_value ?? "0",
      10,
    );
    options.push({ label, votes: Number.isFinite(votes) ? votes : 0 });
  }

  const poll = tweetPollSchema.safeParse({
    options,
    endsAt: values.end_datetime_utc?.string_value ?? null,
    isFinal: values.counts_are_final?.boolean_value === true,
  });
  return poll.success ? poll.data : null;
}

function toIsoDate(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** A snapshot of the quoted tweet, so the quote renders without a second fetch */
export function extractQuotedTweet(
  quoted: RawQuotedTweet | undefined,
): QuotedTweet | null {
  if (!quoted?.id_str || !quoted.user?.screen_name) return null;
  // Parsing strips video variants: a quoted video renders as its poster still
  const snapshot = quotedTweetSchema.safeParse({
    tweetId: quoted.id_str,
    authorName: quoted.user.name ?? null,
    authorUsername: quoted.user.screen_name,
    authorAvatarUrl: quoted.user.profile_image_url_https ?? null,
    text: normalizeTweetText(quoted),
    isTruncated: !!quoted.note_tweet,
    postedAt: toIsoDate(quoted.created_at),
    media: transformTweetMedia(quoted.mediaDetails),
  });
  return snapshot.success ? snapshot.data : null;
}

/**
 * The post this tweet replies to. X includes the parent tweet when it's still
 * available; otherwise only its id and author are known.
 */
export function extractReplyContext(tweet: Tweet): TweetReplyContext | null {
  const tweetId = tweet.in_reply_to_status_id_str;
  const authorUsername = tweet.in_reply_to_screen_name;
  if (!tweetId || !authorUsername) return null;
  const parent = tweet.parent?.id_str === tweetId ? tweet.parent : undefined;
  return {
    tweetId,
    authorUsername: parent?.user?.screen_name ?? authorUsername,
    authorName: parent?.user?.name ?? null,
    text: parent ? normalizeTweetText(parent) : null,
  };
}

/** Transform raw tweet data from react-tweet/api into our TwitterDetails */
export function transformTweetData(tweet: RawTweet): TwitterDetails {
  if (!tweet.user?.screen_name) {
    throw new Error(`Tweet ${tweet.id_str} is missing author username`);
  }

  const quotedTweetId = tweet.quoted_tweet?.id_str ?? null;
  const card = extractTweetCard(tweet);
  // An Article's link and the quoted tweet's permalink render as the card and
  // the quote, so they'd only be noise in the text
  const dropUrl = (url: string) =>
    (card?.type === "article" && ARTICLE_URL.test(url)) ||
    (!!quotedTweetId && url.includes(`/status/${quotedTweetId}`));

  return {
    tweetId: tweet.id_str,
    authorName: tweet.user.name ?? null,
    authorUsername: tweet.user.screen_name,
    authorAvatarUrl: tweet.user.profile_image_url_https ?? null,
    text: normalizeTweetText(tweet, { dropUrl }),
    isTruncated: !!tweet.note_tweet,
    postedAt: toIsoDate(tweet.created_at),
    media: transformTweetMedia(tweet.mediaDetails),
    quotedTweetId,
    quotedTweet: extractQuotedTweet(tweet.quoted_tweet),
    card,
    poll: extractTweetPoll(tweet),
    inReplyTo: extractReplyContext(tweet),
    coverMediaIndex: null,
  };
}

function articleCard(details: Pick<TwitterDetails, "card">) {
  return details.card?.type === "article" ? details.card : null;
}

/** The saved item's title: an Article's own title, else the author */
export function tweetItemTitle(
  details: Pick<TwitterDetails, "card" | "authorUsername">,
): string {
  return articleCard(details)?.title || `Tweet by @${details.authorUsername}`;
}

/** What the tweet says, for its description: the text, else an Article's opening */
export function tweetDescriptionSource(
  details: Pick<TwitterDetails, "text" | "card">,
): string | null {
  return details.text ?? (articleCard(details)?.description || null);
}

/**
 * Everything the tweet says, for tags and embeddings: its text plus the Article
 * preview, quoted tweet and poll options it shows alongside
 */
export function tweetSourceText(
  details: Pick<TwitterDetails, "text" | "card" | "quotedTweet" | "poll">,
): string | undefined {
  const article = articleCard(details);
  const parts = [
    details.text,
    article?.title,
    article?.description,
    details.quotedTweet?.text &&
      `Quoting @${details.quotedTweet.authorUsername}: ${details.quotedTweet.text}`,
    details.poll &&
      `Poll: ${details.poll.options.map((o) => o.label).join(" / ")}`,
  ].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}
