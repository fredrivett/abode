import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TwitterDetailView } from "./twitter-detail-view";
import type { TwitterDetails } from "./types";

beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

const baseTweet: TwitterDetails = {
  tweetId: "42",
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

describe("TwitterDetailView", () => {
  it("links truncated text through to the full post on X", () => {
    render(
      <TwitterDetailView
        twitterDetails={{ ...baseTweet, textTruncated: true }}
        itemId="item-1"
      />,
    );
    expect(
      screen.getByRole("link", { name: "Show more on X" }),
    ).toHaveAttribute("href", "https://x.com/corameridian/status/42");
  });

  it("shows no 'Show more' link for complete text", () => {
    render(<TwitterDetailView twitterDetails={baseTweet} itemId="item-1" />);
    expect(screen.getByText(/Every map is out of date/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Show more on X" }),
    ).not.toBeInTheDocument();
  });
});
