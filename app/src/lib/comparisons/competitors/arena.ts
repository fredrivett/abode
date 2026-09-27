import type { Comparison } from "../types";

export const arena: Comparison = {
  slug: "arena",
  name: "Are.na",
  siteUrl: "https://www.are.na",
  description:
    "abode vs Are.na: channels you connect by hand vs search-first saving with AI. pricing, organisation, search, export and self-hosting compared.",
  intro:
    "Are.na is a thoughtful, member-funded network for connecting ideas: you file blocks into channels by hand, and they gather context from everyone else's channels. abode takes the opposite approach to organising — no filing, AI describes what you save, and search finds it — and it's open source.",
  facts: {
    pricing: "free up to 200 blocks. premium: $7/mo or $70/yr",
    openSource: "no — but it has an open API, SDK and MCP server",
    selfHost: "no",
    organisation:
      "channels you connect blocks into by hand; a block can live in many",
    search: "no AI features; full-text search of links and articles on premium",
    saves: "images, links, text, and uploads of any file type",
    sharing:
      "open, closed and private channels; following, groups, collaborators and comments",
    ads: "no ads and no algorithmic recommendations",
    apps: "web, iOS, android; chrome, firefox and safari extensions",
    export: "per channel as PDF, ZIP or HTML; no whole-account export",
  },
  theyShine: [
    "connective, research-style collecting — the same block in many channels, with context from the whole community",
    "an unusually transparent, member-funded, ad-free company",
    "collaborative and open channels for groups, classes and studios",
  ],
  abodeFits: [
    "you don't want to file every save by hand — abode describes, tags and sorts it for you",
    "you want to search by what's in an image, or find similar ones",
    "you want the code open and the option to host it yourself",
  ],
  sources: [
    { label: "Are.na pricing", url: "https://www.are.na/about#pricing" },
    {
      label: "blocks",
      url: "https://help.are.na/docs/getting-started/blocks",
    },
    {
      label: "channel export",
      url: "https://help.are.na/docs/getting-started/channels/settings-and-export",
    },
    { label: "are.na", url: "https://www.are.na/" },
  ],
  lastChecked: "2026-09-27",
};
