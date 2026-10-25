import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArticleCard } from "./article-card";

const bylineText = (container: HTMLElement) =>
  [...container.querySelectorAll("li")].map((li) => li.textContent);

describe("ArticleCard", () => {
  it("renders the title and a plain-text teaser of the content", () => {
    render(
      <ArticleCard
        title="Don't be a meat proxy"
        content="You are a **meat proxy** ferrying intent between systems, all day long."
        domain="gruhn.me"
        readingTime={4}
      />,
    );

    expect(screen.getByText("Don't be a meat proxy")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You are a meat proxy ferrying intent between systems, all day long.",
      ),
    ).toBeInTheDocument();
  });

  it("prefers the description for the teaser", () => {
    render(
      <ArticleCard
        title="Title"
        description="The publisher's summary"
        content="A long first paragraph of the article body that reads as prose."
        domain="gruhn.me"
        readingTime={4}
      />,
    );

    expect(screen.getByText("The publisher's summary")).toBeInTheDocument();
    expect(screen.queryByText(/first paragraph/)).not.toBeInTheDocument();
  });

  it("reads as a byline: domain · date · reading time", () => {
    const { container } = render(
      <ArticleCard
        title="Title"
        content="Body"
        domain="www.gruhn.me"
        publishedAt="2026-01-15T00:00:00.000Z"
        readingTime={4}
      />,
    );

    expect(bylineText(container)).toEqual([
      "gruhn.me",
      "Jan 15, 2026",
      "4 min read",
    ]);
  });

  it("leads the byline with the author instead of the domain", () => {
    const { container } = render(
      <ArticleCard
        title="Title"
        content="Body"
        domain="gruhn.me"
        author="Rasmus Gruhn"
        readingTime={null}
      />,
    );

    expect(bylineText(container)).toEqual(["Rasmus Gruhn"]);
  });

  it("shows the favicon when given one, else a page icon", () => {
    const { container, rerender } = render(
      <ArticleCard
        title="Title"
        content={null}
        domain="gruhn.me"
        readingTime={null}
        faviconUrl="/favicon.png"
      />,
    );
    expect(container.querySelector("li img")).toHaveAttribute(
      "src",
      "/favicon.png",
    );

    rerender(
      <ArticleCard
        title="Title"
        content={null}
        domain="gruhn.me"
        readingTime={null}
      />,
    );
    expect(container.querySelector("li img")).toBeNull();
    expect(container.querySelector("li svg")).not.toBeNull();
  });

  it("renders no byline when there is nothing to show", () => {
    const { container } = render(
      <ArticleCard
        title="Title"
        content={null}
        domain={null}
        readingTime={null}
      />,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(container.querySelector("ul")).toBeNull();
  });

  describe("cover variant", () => {
    it("renders the cover with the caption below it, without a teaser", () => {
      const { container } = render(
        <ArticleCard
          title="Don't be a meat proxy"
          content="You are a meat proxy ferrying intent between systems, all day long."
          domain="gruhn.me"
          publishedAt="2026-01-15T00:00:00.000Z"
          readingTime={4}
          coverUrl="/cover.jpg"
        />,
      );

      const img = screen.getByRole("img", { name: "Don't be a meat proxy" });
      expect(img).toHaveAttribute("src", "/cover.jpg");
      expect(screen.getByText("Don't be a meat proxy")).toBeInTheDocument();
      expect(bylineText(container)).toEqual([
        "gruhn.me",
        "Jan 15, 2026",
        "4 min read",
      ]);
      expect(screen.queryByText(/ferrying intent/)).not.toBeInTheDocument();
      // Title sits after the image, not overlaid on it
      expect(
        img.compareDocumentPosition(screen.getByText("Don't be a meat proxy")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it("fires onClick when the card is pressed", () => {
    const onClick = vi.fn();
    render(
      <ArticleCard
        title="Title"
        content="Body"
        domain="gruhn.me"
        readingTime={4}
        onClick={onClick}
      />,
    );

    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
