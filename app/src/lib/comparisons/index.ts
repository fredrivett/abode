import { arena } from "./competitors/arena";
import { cosmos } from "./competitors/cosmos";
import { mymind } from "./competitors/mymind";
import { pinterest } from "./competitors/pinterest";
import { raindrop } from "./competitors/raindrop";
import type { Comparison } from "./types";

/** Every "abode vs X" page, in hub order. Each becomes comparePath(slug) */
export const COMPARISONS: readonly Comparison[] = [
  mymind,
  raindrop,
  cosmos,
  arena,
  pinterest,
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((comparison) => comparison.slug === slug);
}
