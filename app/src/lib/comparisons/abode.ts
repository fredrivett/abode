import type { ComparisonFacts } from "./types";

/** abode's column in every comparison table — keep it true to the product */
export const ABODE_FACTS: ComparisonFacts = {
  pricing: "hosted: invite-only early access. self-hosted: free",
  openSource: "yes — AGPL-3.0, every line on github",
  selfHost: "yes — Postgres + Supabase is all it needs",
  organisation:
    "no folders or filing — search, plus rooms (hand-picked or auto-filled by filters)",
  search:
    "AI titles, descriptions, tags and OCR; full-text + semantic search; similar images",
  saves:
    "links, images, articles, tweets, instagram posts, videos, products, books, notes",
  sharing: "public profile and public rooms, share links for single items",
  ads: "no ads, no feed, no algorithm",
  apps: "web (installable), chrome/edge extension",
  export: "self-host and the database is yours; API + personal access tokens",
};
