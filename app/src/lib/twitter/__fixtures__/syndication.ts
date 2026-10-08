import type { RawTweet } from "@/lib/twitter/transform-tweet";

/**
 * X embed (syndication) payloads for each kind of tweet, shaped after real
 * responses but with made-up authors and text. Only the fields we read are
 * filled in, hence the casts.
 */

const user = (screenName: string, name: string) => ({
  screen_name: screenName,
  name,
  profile_image_url_https: `https://pbs.twimg.com/profile_images/1/${screenName}_normal.jpg`,
});

const LONG_TEXT =
  "Spent the weekend rebuilding the garden shed from salvaged timber. The old one had rotted through at the base, so the first job was a proper footing: gravel, slabs, then treated bearers. Walls went up quickly once the frame was square. The roof took longer than the rest of";

/** A long-form post: X sends ~280 chars and a `note_tweet` marker */
export const longTweet = {
  id_str: "1900000000000000001",
  text: LONG_TEXT,
  display_text_range: [0, 279],
  entities: { hashtags: [], urls: [], user_mentions: [], symbols: [] },
  note_tweet: { id: "Tm90ZVR3ZWV0UmVzdWx0czox" },
  created_at: "2026-10-01T20:23:00.000Z",
  user: user("jonahpierce", "Jonah Pierce"),
} as unknown as RawTweet;

/** A long-form post with a photo: the photo's t.co link trails the text */
export const longTweetWithPhoto = {
  ...longTweet,
  text: `${LONG_TEXT} https://t.co/photo123`,
  // Overshoots into the photo link, which the range should exclude
  display_text_range: [0, 280],
  entities: {
    hashtags: [],
    urls: [],
    user_mentions: [],
    symbols: [],
    media: [
      {
        url: "https://t.co/photo123",
        indices: [274, 295],
        display_url: "pic.x.com/photo123",
        expanded_url: "https://x.com/jonahpierce/status/1/photo/1",
      },
    ],
  },
  mediaDetails: [
    {
      type: "photo",
      media_url_https: "https://pbs.twimg.com/media/shed.jpg",
      original_info: { width: 1200, height: 900 },
    },
  ],
} as unknown as RawTweet;

/** An X Article: the post's text is just the Article's t.co link */
export const articleTweet = {
  id_str: "1900000000000000002",
  text: "Do the maths. https://t.co/article1",
  display_text_range: [0, 35],
  entities: {
    hashtags: [],
    urls: [
      {
        url: "https://t.co/article1",
        expanded_url: "http://x.com/i/article/1900000000000000099",
        display_url: "x.com/i/article/1900…",
        indices: [14, 35],
      },
    ],
    user_mentions: [],
    symbols: [],
  },
  article: {
    rest_id: "1900000000000000099",
    title: "What a year of composting taught me",
    preview_text:
      "Twelve months ago I started a compost heap with no idea what I was doing. Here is everything that went wrong, what finally worked, and the numbers behind it.",
    cover_media: {
      media_info: {
        original_img_url: "https://pbs.twimg.com/media/compost.jpg",
      },
    },
  },
  created_at: "2026-10-02T09:00:00.000Z",
  user: user("nadiabuilds", "Nadia Builds"),
} as unknown as RawTweet;

/** A quote tweet whose quoted post is itself long-form, with a photo */
export const quoteTweet = {
  id_str: "1900000000000000003",
  text: "This is the best write-up on sheds I've read &amp; I've read a few",
  display_text_range: [0, 66],
  entities: { hashtags: [], urls: [], user_mentions: [], symbols: [] },
  quoted_tweet: {
    id_str: "1900000000000000001",
    text: LONG_TEXT,
    display_text_range: [0, 279],
    entities: { hashtags: [], urls: [], user_mentions: [], symbols: [] },
    note_tweet: { id: "Tm90ZVR3ZWV0UmVzdWx0czox" },
    created_at: "2026-10-01T20:23:00.000Z",
    user: user("jonahpierce", "Jonah Pierce"),
    mediaDetails: [
      {
        type: "video",
        media_url_https: "https://pbs.twimg.com/media/shed-poster.jpg",
        original_info: { width: 1280, height: 720 },
        video_info: {
          variants: [
            {
              content_type: "video/mp4",
              url: "https://video.twimg.com/shed.mp4",
              bitrate: 832000,
            },
          ],
        },
      },
    ],
  },
  created_at: "2026-10-02T10:00:00.000Z",
  user: user("nadiabuilds", "Nadia Builds"),
} as unknown as RawTweet;

/** A finished two-option poll */
export const pollTweet = {
  id_str: "1900000000000000004",
  text: "Shed roof: felt or corrugated?",
  display_text_range: [0, 30],
  entities: { hashtags: [], urls: [], user_mentions: [], symbols: [] },
  card: {
    name: "poll2choice_text_only",
    url: "https://twitter.com",
    binding_values: {
      choice1_label: { string_value: "Felt", type: "STRING" },
      choice2_label: { string_value: "Corrugated", type: "STRING" },
      choice1_count: { string_value: "312", type: "STRING" },
      choice2_count: { string_value: "488", type: "STRING" },
      end_datetime_utc: {
        string_value: "2026-10-03T11:20:32Z",
        type: "STRING",
      },
      counts_are_final: { boolean_value: true, type: "BOOLEAN" },
    },
  },
  created_at: "2026-10-02T11:20:32.000Z",
  user: user("jonahpierce", "Jonah Pierce"),
} as unknown as RawTweet;

/** A reply: the leading @mention sits outside the display range */
export const replyTweet = {
  id_str: "1900000000000000005",
  text: "@jonahpierce Treated bearers every time 👍 https://t.co/link1",
  // X counts this range in UTF-16 units, so the 👍 pushes it one past the end
  display_text_range: [13, 61],
  entities: {
    hashtags: [],
    urls: [
      {
        url: "https://t.co/link1",
        expanded_url: "https://example.com/bearers",
        display_url: "example.com/bearers",
        indices: [42, 60],
      },
    ],
    user_mentions: [
      {
        id_str: "1",
        name: "Jonah Pierce",
        screen_name: "jonahpierce",
        indices: [0, 12],
      },
    ],
    symbols: [],
  },
  in_reply_to_screen_name: "jonahpierce",
  in_reply_to_status_id_str: "1900000000000000001",
  parent: {
    id_str: "1900000000000000001",
    text: "What do you all use under a shed?",
    display_text_range: [0, 33],
    entities: { hashtags: [], urls: [], user_mentions: [], symbols: [] },
    user: user("jonahpierce", "Jonah Pierce"),
  },
  created_at: "2026-10-02T12:00:00.000Z",
  user: user("nadiabuilds", "Nadia Builds"),
} as unknown as RawTweet;
