import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TweetLinkCard } from "./tweet-link-card";

const linkCard = {
  title: "Choosing shed felt",
  description: "A buyer's guide",
  url: "https://example.com/felt",
  imageUrl: "https://pbs.twimg.com/card.jpg",
};

const articleCard = {
  type: "article" as const,
  title: "What a year of composting taught me",
  description: "Twelve months ago I started a compost heap.",
  url: "https://x.com/i/article/99",
  imageUrl: "https://pbs.twimg.com/cover.jpg",
};

describe("TweetLinkCard", () => {
  it("shows a link card's site, title and description", () => {
    render(<TweetLinkCard card={linkCard} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("Choosing shed felt")).toBeInTheDocument();
    expect(screen.getByText("A buyer's guide")).toBeInTheDocument();
    expect(screen.queryByText(/full Article/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Link preview: Choosing shed felt" }),
    ).toBeInTheDocument();
  });

  it("presents an Article as an Article, pointing to the rest on X", () => {
    render(<TweetLinkCard card={articleCard} />);
    expect(screen.getByText("Article on X")).toBeInTheDocument();
    expect(screen.getByText("Read the full Article on X")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://x.com/i/article/99",
    );
    expect(
      screen.getByRole("img", {
        name: "Article cover: What a year of composting taught me",
      }),
    ).toBeInTheDocument();
  });

  it("omits the image when there's none", () => {
    render(<TweetLinkCard card={{ ...articleCard, imageUrl: null }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("doesn't link out when the stored URL isn't http(s)", () => {
    render(
      <TweetLinkCard card={{ ...linkCard, url: "javascript:alert(1)" }} />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Choosing shed felt")).toBeInTheDocument();
    expect(screen.queryByText("javascript:alert(1)")).not.toBeInTheDocument();
  });

  it("drops the 'read on X' prompt for an Article with no usable URL", () => {
    render(<TweetLinkCard card={{ ...articleCard, url: "not a url" }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/full Article/)).not.toBeInTheDocument();
  });
});
