import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TwitterDetailView } from "./twitter-detail-view";
import type { TwitterDetails } from "./types";

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture } }));

const baseTweet: TwitterDetails = {
  tweetId: "1",
  authorName: "Jonah Pierce",
  authorUsername: "jonahpierce",
  authorAvatarUrl: null,
  text: "Spent the weekend rebuilding the shed",
  isTruncated: false,
  postedAt: null,
  media: null,
  quotedTweetId: null,
  quotedTweet: null,
  card: null,
  poll: null,
  inReplyTo: null,
  coverMediaIndex: null,
};

function renderTweet(overrides: Partial<TwitterDetails> = {}) {
  return render(
    <TwitterDetailView
      twitterDetails={{ ...baseTweet, ...overrides }}
      itemId="item-1"
    />,
  );
}

describe("TwitterDetailView", () => {
  it("shows the full text with no 'Show more' link for a regular tweet", () => {
    renderTweet();
    expect(screen.getByText(baseTweet.text ?? "")).toBeInTheDocument();
    expect(screen.queryByText("Show more on X")).not.toBeInTheDocument();
  });

  it("links a cut-off long-form post to the rest on X, tracking the click", () => {
    renderTweet({ isTruncated: true });
    const showMore = screen.getByRole("link", { name: "Show more on X" });
    expect(showMore).toHaveAttribute(
      "href",
      "https://x.com/jonahpierce/status/1",
    );
    expect(showMore.parentElement).toHaveTextContent(
      "Spent the weekend rebuilding the shed… Show more on X",
    );
    fireEvent.click(showMore);
    expect(capture).toHaveBeenCalledWith("tweet_show_more_clicked", {
      item_id: "item-1",
    });
  });

  it("still offers 'Show more' when a truncated post has no saved text", () => {
    renderTweet({ text: null, isTruncated: true });
    expect(
      screen.getByRole("link", { name: "Show more on X" }).parentElement,
    ).toHaveTextContent(/^Show more on X$/);
  });

  it("renders the reply context, poll, card and quote when present", () => {
    renderTweet({
      inReplyTo: {
        tweetId: "7",
        authorUsername: "nadiabuilds",
        authorName: null,
        text: "Parent post",
      },
      poll: {
        options: [
          { label: "Felt", votes: 1 },
          { label: "Tin", votes: 3 },
        ],
        endsAt: null,
        isFinal: true,
      },
      card: {
        type: "article",
        title: "Article title",
        description: "",
        url: "https://x.com/i/article/9",
        imageUrl: null,
      },
      quotedTweet: {
        tweetId: "8",
        authorName: null,
        authorUsername: "quoted",
        authorAvatarUrl: null,
        text: "Quoted post",
        isTruncated: false,
        postedAt: null,
        media: null,
      },
    });
    expect(screen.getByText("Parent post")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Article title")).toBeInTheDocument();
    expect(screen.getByText("Quoted post")).toBeInTheDocument();
  });
});
