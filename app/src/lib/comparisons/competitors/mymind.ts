import type { Comparison } from "../types";

export const mymind: Comparison = {
  slug: "mymind",
  name: "mymind",
  siteUrl: "https://mymind.com",
  description:
    "abode vs mymind: both skip the folders. mymind is a polished private vault; abode is open source, self-hostable and shareable. pricing, AI and export compared.",
  intro:
    "mymind and abode share a belief: save everything, organise nothing, let search do the work. mymind is the more mature, polished app and deliberately private. abode is open source, runs on your own server if you want, and lets you share what you've collected.",
  verdict: {
    them: "you want the most polished private vault, with native apps and nothing public",
    abode:
      "you want the same no-folders idea, open source and self-hostable, with public rooms to share",
  },
  facts: {
    pricing:
      "free guest plan up to 100 cards. paid from $4.99/mo (no AI) to $12.99/mo; AI features start at $7.99/mo",
    openSource: "no",
    selfHost: "no — hosted on AWS",
    organisation: "no folders — auto-tags plus spaces, including smart spaces",
    search:
      "AI image tagging, text recognition in images, visual and semantic search; summaries on the top plan",
    saves:
      "notes, bookmarks, images, articles, products, books, highlights, PDFs; video uploads on the top plan",
    sharing:
      "single-card private links that expire after 24 hours; no public pages",
    ads: "no ads, no social features, no feed",
    apps: "web, iOS, android, macOS; chrome, edge and safari extensions",
    export:
      "“export my mind” downloads your files plus a cards.csv (chrome or edge only)",
  },
  theyShine: [
    "the most polished “save anything, organise nothing” experience, with strong image AI — search by object, colour or text in an image, and find similar vibes",
    "native apps on iOS, android and macOS",
    "a strict privacy stance in writing: no ads, no training on your data, no social layer",
  ],
  abodeFits: [
    "you want the code to be open, and the option to run it on your own server",
    "you want to share — a public profile and public rooms, not links that expire in a day",
    "you want a free option with no card limit — self-hosted abode has none",
  ],
  sources: [
    { label: "mymind pricing", url: "https://access.mymind.com/pricing" },
    {
      label: "free plan",
      url: "https://mymind.helpscoutdocs.com/article/72-free-plan",
    },
    {
      label: "export",
      url: "https://mymind.helpscoutdocs.com/article/18-can-i-export",
    },
    { label: "our promise", url: "https://mymind.com/our-promise" },
    {
      label: "private share links",
      url: "https://mymind.helpscoutdocs.com/article/28-how-to-create-a-private-sharelink",
    },
  ],
  lastChecked: "2026-09-27",
};
