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
