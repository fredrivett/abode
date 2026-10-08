import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuotedTweet } from "./quoted-tweet";
import type { QuotedTweet as QuotedTweetData } from "./types";

const quote: QuotedTweetData = {
  tweetId: "42",
  authorName: "Jonah Pierce",
  authorUsername: "jonahpierce",
  authorAvatarUrl: null,
  text: "Rebuilt the shed this weekend.",
  isTruncated: false,
  postedAt: null,
  media: null,
};

describe("QuotedTweet", () => {
  it("links to the quoted tweet on X", () => {
    render(<QuotedTweet quote={quote} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://x.com/jonahpierce/status/42",
    );
  });

  it("shows the author's name and handle", () => {
    render(<QuotedTweet quote={quote} />);
    expect(screen.getByText("Jonah Pierce")).toBeInTheDocument();
    expect(screen.getByText("@jonahpierce")).toBeInTheDocument();
  });

  it("falls back to the handle alone when there's no display name", () => {
    render(<QuotedTweet quote={{ ...quote, authorName: null }} />);
    expect(screen.getAllByText("@jonahpierce")).toHaveLength(1);
  });

  it("ends a long-form quote's text with an ellipsis", () => {
    render(<QuotedTweet quote={{ ...quote, isTruncated: true }} />);
    expect(
      screen.getByText("Rebuilt the shed this weekend.…"),
    ).toBeInTheDocument();
  });

  it("shows photo stills and video posters, skipping media with neither", () => {
    render(
      <QuotedTweet
        quote={{
          ...quote,
          media: [
            { type: "photo", url: "https://pbs.twimg.com/a.jpg" },
            {
              type: "video",
              url: "https://pbs.twimg.com/b.jpg",
              posterUrl: "https://pbs.twimg.com/b-poster.jpg",
            },
            { type: "animated_gif", url: "https://pbs.twimg.com/c.jpg" },
          ],
        }}
      />,
    );
    const images = screen.getAllByRole("img");
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "https://pbs.twimg.com/a.jpg",
      "https://pbs.twimg.com/b-poster.jpg",
    ]);
  });

  it("renders every still, even when the same image repeats", () => {
    const url = "https://pbs.twimg.com/same.jpg";
    render(
      <QuotedTweet
        quote={{
          ...quote,
          media: [
            { type: "photo", url },
            { type: "photo", url },
          ],
        }}
      />,
    );
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });
});
