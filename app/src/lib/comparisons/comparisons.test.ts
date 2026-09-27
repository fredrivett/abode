import { describe, expect, it } from "vitest";
import { ABODE_FACTS } from "./abode";
import { COMPARISONS, getComparison } from "./index";
import { COMPARISON_ROWS } from "./types";

describe("comparisons", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = COMPARISONS.map(({ slug }) => slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("fills every table row, for abode and each competitor", () => {
    for (const { key } of COMPARISON_ROWS) {
      expect(ABODE_FACTS[key].trim(), `abode ${key}`).not.toBe("");
      for (const comparison of COMPARISONS) {
        expect(
          comparison.facts[key].trim(),
          `${comparison.slug} ${key}`,
        ).not.toBe("");
      }
    }
  });

  it("gives every comparison a two-sided verdict", () => {
    for (const { slug, verdict } of COMPARISONS) {
      expect(verdict.them.trim(), slug).not.toBe("");
      expect(verdict.abode.trim(), slug).not.toBe("");
      expect(verdict.them.trim(), slug).not.toBe(verdict.abode.trim());
    }
  });

  it("gives every comparison at least one question of its own", () => {
    for (const { slug, faqs } of COMPARISONS) {
      expect(faqs.length, slug).toBeGreaterThan(0);
      for (const { question, answer } of faqs) {
        expect(question.trim(), slug).not.toBe("");
        expect(answer.trim(), slug).not.toBe("");
      }
    }
  });

  // Honest pages: every competitor claim is sourced and dated
  it.each(COMPARISONS.map((c) => [c.slug, c] as const))(
    "%s cites https sources and a valid, past check date",
    (_slug, comparison) => {
      expect(comparison.sources.length).toBeGreaterThan(0);
      for (const { url } of comparison.sources) {
        const parsed = new URL(url);
        expect(parsed.protocol).toBe("https:");
        expect(parsed.hostname).toContain(".");
      }

      const checked = new Date(`${comparison.lastChecked}T00:00:00Z`);
      expect(comparison.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(checked.getTime())).toBe(false);
      // Catches impossible dates like 2026-09-31, which Date rolls forward
      expect(checked.toISOString().slice(0, 10)).toBe(comparison.lastChecked);
      expect(checked.getTime()).toBeLessThanOrEqual(Date.now());
    },
  );

  it("keeps meta descriptions within search-result length", () => {
    for (const { slug, description } of COMPARISONS) {
      expect(description.length, slug).toBeLessThanOrEqual(160);
    }
  });

  it("looks comparisons up by slug", () => {
    expect(getComparison("mymind")?.name).toBe("mymind");
    expect(getComparison("nope")).toBeUndefined();
  });
});
