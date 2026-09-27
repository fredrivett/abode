import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleDetailPlaceholder } from "./article-detail-placeholder";

describe("ArticleDetailPlaceholder", () => {
  it("shows the article's title (entities decoded) above skeleton text", () => {
    const { container } = render(
      <ArticleDetailPlaceholder title="Cats &amp; dogs" />,
    );
    expect(
      screen.getByRole("heading", { name: "Cats & dogs" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
    expect(container.querySelector("article")).toHaveAttribute("aria-busy");
  });

  it("works without a title", () => {
    render(<ArticleDetailPlaceholder title={undefined} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
