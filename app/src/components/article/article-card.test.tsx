import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArticleCard } from "./article-card";

describe("ArticleCard", () => {
  it("renders the title and a preview of the content", () => {
    render(
      <ArticleCard
        title="Don't be a meat proxy"
        content="You are a **meat proxy** ferrying intent between systems."
        domain="gruhn.me"
        readingTime={4}
      />,
    );

    expect(screen.getByText("Don't be a meat proxy")).toBeInTheDocument();
    expect(screen.getByText(/ferrying intent/)).toBeInTheDocument();
  });

  it("shows domain and reading time in the footer when both are present", () => {
    render(
      <ArticleCard
        title="Title"
        content="Body"
        domain="gruhn.me"
        readingTime={4}
      />,
    );

    expect(screen.getByText("gruhn.me · 4 min read")).toBeInTheDocument();
  });

  it("reads as a byline: domain · date · reading time", () => {
    render(
      <ArticleCard
        title="Title"
        content="Body"
        domain="gruhn.me"
        publishedAt="2026-01-15T00:00:00.000Z"
        readingTime={4}
      />,
    );

    expect(
      screen.getByText("gruhn.me · Jan 15, 2026 · 4 min read"),
    ).toBeInTheDocument();
  });

  it("leads the byline with the author when present", () => {
    render(
      <ArticleCard
        title="Title"
        content="Body"
        domain="gruhn.me"
        author="Rasmus Gruhn"
        publishedAt="2026-01-15T00:00:00.000Z"
        readingTime={4}
      />,
    );

    expect(
      screen.getByText("Rasmus Gruhn · Jan 15, 2026 · 4 min read"),
    ).toBeInTheDocument();
    // Author replaces the domain, it doesn't stack with it
    expect(screen.queryByText(/gruhn\.me/)).not.toBeInTheDocument();
  });

  it("falls back to the domain when there is no author", () => {
    render(
      <ArticleCard
        title="Title"
        content="Body"
        domain="gruhn.me"
        author={null}
        readingTime={4}
      />,
    );

    expect(screen.getByText("gruhn.me · 4 min read")).toBeInTheDocument();
  });

  it("omits reading time when it is not available", () => {
    render(
      <ArticleCard
        title="Title"
        content="Body"
        domain="gruhn.me"
        readingTime={null}
      />,
    );

    expect(screen.getByText("gruhn.me")).toBeInTheDocument();
    expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
  });

  it("renders without a content preview when there is no content", () => {
    render(
      <ArticleCard
        title="Title"
        content={null}
        domain="gruhn.me"
        readingTime={null}
      />,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("gruhn.me")).toBeInTheDocument();
  });

  it("renders no footer when there is neither domain nor reading time", () => {
    render(
      <ArticleCard
        title="Title"
        content="Body"
        domain={null}
        readingTime={null}
      />,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
  });

  describe("cover variant", () => {
    it("shows date, domain and reading time, but not the body", () => {
      render(
        <ArticleCard
          title="Don't be a meat proxy"
          content="You are a **meat proxy** ferrying intent between systems."
          domain="gruhn.me"
          publishedAt="2026-01-15T00:00:00.000Z"
          readingTime={4}
          coverUrl="/cover.jpg"
        />,
      );

      expect(screen.getByText("Don't be a meat proxy")).toBeInTheDocument();
      expect(screen.getByText(/Jan 15, 2026/)).toBeInTheDocument();
      expect(screen.getByText(/gruhn\.me/)).toBeInTheDocument();
      expect(screen.getByText(/4 min read/)).toBeInTheDocument();
      // Body is never rendered in the cover variant
      expect(screen.queryByText(/ferrying intent/)).not.toBeInTheDocument();
    });

    it("renders the cover image", () => {
      render(
        <ArticleCard
          title="Title"
          content="Body"
          domain="gruhn.me"
          readingTime={4}
          coverUrl="/cover.jpg"
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "/cover.jpg");
      expect(img).toHaveAttribute("alt", "Title");
    });

    it("omits the date when publishedAt is missing", () => {
      render(
        <ArticleCard
          title="Title"
          content="Body"
          domain="gruhn.me"
          readingTime={4}
          coverUrl="/cover.jpg"
        />,
      );

      expect(screen.getByText("gruhn.me · 4 min read")).toBeInTheDocument();
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
