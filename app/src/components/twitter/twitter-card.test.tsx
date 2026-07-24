import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TwitterCard } from "./twitter-card";
import type { TwitterDetails } from "./types";

// useAutoplayAllowed reads window.matchMedia on mount (absent in jsdom)
beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

const baseTweet: TwitterDetails = {
  tweetId: "1",
  authorName: "Cora Meridian",
  authorUsername: "corameridian",
  authorAvatarUrl: null,
  text: "Every map is out of date the second it's printed.",
  postedAt: null,
  media: null,
  quotedTweetId: null,
  card: null,
  coverMediaIndex: null,
};

describe("TwitterCard", () => {
  it("shows the tweet text and author when there is no media", () => {
    render(<TwitterCard twitterDetails={baseTweet} onClick={() => {}} />);
    expect(screen.getByText(/Every map is out of date/)).toBeInTheDocument();
    expect(screen.getByText("Cora Meridian")).toBeInTheDocument();
  });

  it("shows media instead of text when the tweet has a photo", () => {
    render(
      <TwitterCard
        twitterDetails={{
          ...baseTweet,
          media: [{ type: "photo", url: "https://example.com/p.jpg" }],
        }}
        onClick={() => {}}
      />,
    );
    expect(
      screen.queryByText(/Every map is out of date/),
    ).not.toBeInTheDocument();
  });

  it("falls back to the placeholder when there is neither media nor text", () => {
    render(
      <TwitterCard
        twitterDetails={{ ...baseTweet, text: null }}
        onClick={() => {}}
      />,
    );
    expect(screen.queryByText("Cora Meridian")).not.toBeInTheDocument();
  });
});
