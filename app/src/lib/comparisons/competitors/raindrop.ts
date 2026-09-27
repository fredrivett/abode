import type { Comparison } from "../types";

export const raindrop: Comparison = {
  slug: "raindrop",
  name: "Raindrop",
  siteUrl: "https://raindrop.io",
  description:
    "abode vs Raindrop.io: a folder-first bookmark manager vs a search-first home for everything you save. pricing, AI, self-hosting and export compared.",
  intro:
    "Raindrop is a great bookmark manager: collections, tags, archiving and apps for every platform, with a generous free plan. abode is less about managing links and more about keeping everything you find — images, tweets, notes — and finding it again without filing it first.",
  facts: {
    pricing: "free with unlimited bookmarks. pro: $3/mo or $28/yr",
    openSource: "the apps are open source; the server isn't",
    selfHost: "no",
    organisation: "folder-first — nested collections, tags and filters",
    search:
      "AI tag and collection suggestions, semantic search and an AI assistant (pro); full-text search of pages and PDFs (pro); no OCR",
    saves:
      "links, articles, videos, highlights, notes, uploaded files (images, video, audio, PDFs, epub)",
    sharing:
      "public collection pages and a public profile; invite collaborators to collections",
    ads: "no ads, no trackers, no feed",
    apps: "web, iOS, android, macOS, windows; chrome, firefox, safari and edge extensions",
    export:
      "export everything any time as HTML, CSV or TXT (uploaded files as a ZIP)",
  },
  theyShine: [
    "classic bookmark management at scale — nested collections, duplicate and broken-link finding, standard import and export",
    "permanent web archive copies and full-text search of pages, PDFs and YouTube transcripts",
    "apps for every platform, including windows and firefox, and unlimited bookmarks for free",
  ],
  abodeFits: [
    "you'd rather not file things at all — search and smart rooms instead of folders",
    "you save lots of images and screenshots: abode reads the text in them and finds similar ones",
    "you want to run the whole thing yourself, server included",
  ],
  sources: [
    { label: "Raindrop pricing", url: "https://raindrop.io/pro/buy" },
    { label: "search", url: "https://help.raindrop.io/using-search" },
    { label: "export", url: "https://help.raindrop.io/export" },
    { label: "security", url: "https://help.raindrop.io/security" },
    { label: "public pages", url: "https://help.raindrop.io/public-page" },
  ],
  lastChecked: "2026-09-27",
};
