/** Rows of the side-by-side table, in display order */
export const COMPARISON_ROWS = [
  { key: "pricing", label: "pricing" },
  { key: "openSource", label: "open source" },
  { key: "selfHost", label: "self-hostable" },
  { key: "organisation", label: "how you organise" },
  { key: "search", label: "AI & search" },
  { key: "saves", label: "what you can save" },
  { key: "sharing", label: "sharing" },
  { key: "ads", label: "ads & feeds" },
  { key: "apps", label: "apps" },
  { key: "export", label: "getting your data out" },
] as const;

export type ComparisonRowKey = (typeof COMPARISON_ROWS)[number]["key"];

export type ComparisonFacts = Record<ComparisonRowKey, string>;

export type Comparison = {
  slug: string;
  name: string;
  siteUrl: string;
  /** Meta description — what the page answers, for search results */
  description: string;
  /** Honest one-paragraph take shown under the heading */
  intro: string;
  facts: ComparisonFacts;
  /** What the competitor genuinely does better — keep these fair */
  theyShine: string[];
  abodeFits: string[];
  /** Primary sources the facts were checked against */
  sources: { label: string; url: string }[];
  /** ISO date the facts were last checked against the sources */
  lastChecked: string;
};
