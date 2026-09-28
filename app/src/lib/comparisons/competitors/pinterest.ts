import type { Comparison } from "../types";

export const pinterest: Comparison = {
  slug: "pinterest",
  name: "Pinterest",
  siteUrl: "https://www.pinterest.com",
  description:
    "abode vs Pinterest: an ad-supported discovery feed vs a private, ad-free home for what you save. ads, AI training, search and export compared.",
  intro:
    "Pinterest is a vast visual discovery engine — endless ideas for recipes, homes and outfits, paid for by ads. abode is for keeping what you find, not being fed more: no ads, no feed, private by default, and open source.",
  verdict: {
    them: "you want endless inspiration to browse and don't mind ads",
    abode:
      "you want to keep what you find — privately, with no ads and no feed",
  },
  facts: {
    pricing: "free, ad-supported",
    openSource: "no",
    selfHost: "no",
    organisation: "boards and sections; secret boards for private pins",
    search: "visual search with Lens and tap-to-search inside pins",
    saves: "images, videos and products, linking back to their source",
    sharing:
      "fully social — public profiles and boards, following, group boards",
    ads: "personalised ads and a recommendation feed",
    apps: "web, iOS, android; browser save extension",
    export: "request a data download by email (up to 48 hours)",
  },
  theyShine: [
    "an enormous library of visual ideas — inspiration for anything, instantly",
    "excellent visual search, including shopping the look",
    "collaborative boards for planning with friends and family",
  ],
  abodeFits: [
    "you want a place to keep your own finds, without ads or a feed pulling you elsewhere",
    "you save links, tweets, articles and notes too, not just pictures",
    "you'd rather your saves didn't feed an image generator — Pinterest trains its model on public pins unless you opt out",
  ],
  faqs: [
    {
      question: "can I discover new ideas on abode?",
      answer:
        "not really — abode is for keeping what you find, not browsing everyone else's. you can visit the public profiles and rooms people share, but there's no discovery feed.",
    },
  ],
  sources: [
    {
      label: "privacy policy",
      url: "https://policy.pinterest.com/en/privacy-policy",
    },
    {
      label: "AI at Pinterest",
      url: "https://help.pinterest.com/en/article/ai-at-pinterest",
    },
    {
      label: "download your data",
      url: "https://help.pinterest.com/en/article/download-your-pinterest-data",
    },
    {
      label: "all about Pinterest",
      url: "https://help.pinterest.com/en/guide/all-about-pinterest",
    },
  ],
  lastChecked: "2026-09-27",
};
