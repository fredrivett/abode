import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TweetReplyContext } from "./tweet-reply-context";

const inReplyTo = {
  tweetId: "7",
  authorUsername: "jonahpierce",
  authorName: "Jonah Pierce",
  text: "What do you all use under a shed?",
};

describe("TweetReplyContext", () => {
  it("shows who's being replied to and their post, linking to it", () => {
    render(
      <TweetReplyContext inReplyTo={inReplyTo} authorUsername="nadiabuilds" />,
    );
    expect(screen.getByText(/Replying to/)).toBeInTheDocument();
    expect(screen.getByText(inReplyTo.text)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://x.com/jonahpierce/status/7",
    );
  });

  it("calls a reply to yourself part of your thread (case-insensitive)", () => {
    render(
      <TweetReplyContext inReplyTo={inReplyTo} authorUsername="JonahPierce" />,
    );
    expect(screen.getByText(/Continues a thread by/)).toBeInTheDocument();
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument();
  });

  it("still names the parent's author when its text is unavailable", () => {
    render(
      <TweetReplyContext
        inReplyTo={{ ...inReplyTo, text: null }}
        authorUsername="nadiabuilds"
      />,
    );
    expect(screen.getByText("@jonahpierce")).toBeInTheDocument();
    expect(screen.queryByText(inReplyTo.text)).not.toBeInTheDocument();
  });
});
