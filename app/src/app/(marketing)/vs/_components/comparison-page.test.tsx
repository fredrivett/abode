import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getComparison } from "@/lib/comparisons";
import { ABODE_FACTS } from "@/lib/comparisons/abode";

// The closing CTA pulls in the waitlist form; not what's under test here
vi.mock("../../_components/closing-cta", () => ({ ClosingCta: () => null }));

import { ComparisonPage } from "./comparison-page";

const comparison = getComparison("raindrop");
if (!comparison) throw new Error("raindrop comparison missing");

describe("ComparisonPage", () => {
  it("puts abode's and the competitor's facts side by side", () => {
    render(<ComparisonPage comparison={comparison} />);

    const row = screen.getByRole("row", { name: /^pricing/ });
    expect(within(row).getByText(ABODE_FACTS.pricing)).toBeInTheDocument();
    expect(within(row).getByText(comparison.facts.pricing)).toBeInTheDocument();
  });

  it("links every source and dates the check", () => {
    render(<ComparisonPage comparison={comparison} />);

    for (const source of comparison.sources) {
      expect(screen.getByRole("link", { name: source.label })).toHaveAttribute(
        "href",
        source.url,
      );
    }
    expect(screen.getByText(/27 September 2026/)).toBeInTheDocument();
  });

  it("links the other comparisons, not this one", () => {
    render(<ComparisonPage comparison={comparison} />);

    expect(
      screen.getByRole("link", { name: "abode vs mymind" }),
    ).toHaveAttribute("href", "/vs/mymind");
    expect(
      screen.queryByRole("link", { name: "abode vs Raindrop" }),
    ).not.toBeInTheDocument();
  });
});
