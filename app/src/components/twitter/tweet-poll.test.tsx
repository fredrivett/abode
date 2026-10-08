import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TweetPoll } from "./tweet-poll";

const poll = {
  options: [
    { label: "Felt", votes: 312 },
    { label: "Corrugated", votes: 488 },
  ],
  endsAt: "2026-10-03T11:20:32Z",
  isFinal: true,
};

function optionRow(label: string) {
  const row = screen.getByText(label).closest("li");
  if (!row) throw new Error(`No poll option ${label}`);
  return row;
}

describe("TweetPoll", () => {
  it("shows each option's share of the vote", () => {
    render(<TweetPoll poll={poll} />);
    expect(within(optionRow("Felt")).getByText("39%")).toBeInTheDocument();
    expect(
      within(optionRow("Corrugated")).getByText("61%"),
    ).toBeInTheDocument();
  });

  it("emphasises the leading option only", () => {
    render(<TweetPoll poll={poll} />);
    expect(screen.getByText("Corrugated")).toHaveClass("font-semibold");
    expect(screen.getByText("Felt")).not.toHaveClass("font-semibold");
  });

  it("says final results once the poll has closed", () => {
    render(<TweetPoll poll={poll} />);
    expect(screen.getByText("800 votes · Final results")).toBeInTheDocument();
  });

  it("labels an open poll's counts as a snapshot", () => {
    render(<TweetPoll poll={{ ...poll, isFinal: false }} />);
    expect(screen.getByText(/Results when saved/)).toBeInTheDocument();
  });

  it("handles a poll nobody has voted in (no leader, 0%)", () => {
    render(
      <TweetPoll
        poll={{
          ...poll,
          options: poll.options.map((o) => ({ ...o, votes: 0 })),
        }}
      />,
    );
    expect(screen.getAllByText("0%")).toHaveLength(2);
    expect(screen.getByText("Felt")).not.toHaveClass("font-semibold");
    expect(screen.getByText(/^0 votes/)).toBeInTheDocument();
  });

  it("uses the singular for a single vote, with thousands separators otherwise", () => {
    const { rerender } = render(
      <TweetPoll
        poll={{
          ...poll,
          options: [
            { label: "A", votes: 1 },
            { label: "B", votes: 0 },
          ],
        }}
      />,
    );
    expect(screen.getByText(/^1 vote ·/)).toBeInTheDocument();
    rerender(
      <TweetPoll
        poll={{
          ...poll,
          options: [
            { label: "A", votes: 10063044 },
            { label: "B", votes: 7439347 },
          ],
        }}
      />,
    );
    expect(screen.getByText(/^17,502,391 votes/)).toBeInTheDocument();
  });
});
