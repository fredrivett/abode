import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstagramCard } from "./instagram-card";
import type { InstagramDetails } from "./types";

const baseDetails: InstagramDetails = {
  postId: "DbMJgxFiNTq",
  mediaType: "post",
  authorName: "Oliver Hamrin",
  authorUsername: "oliverhamrin",
  caption: "From the archive",
  postedAt: null,
  media: null,
  likeCount: null,
  commentCount: null,
  coverMediaIndex: null,
};

describe("InstagramCard", () => {
  it("shows the caption and author when there is no media", () => {
    render(<InstagramCard instagramDetails={baseDetails} onClick={() => {}} />);
    expect(screen.getByText("From the archive")).toBeInTheDocument();
    expect(screen.getByText("Oliver Hamrin")).toBeInTheDocument();
  });

  it("shows the cover image (not the caption) when the post has media", () => {
    render(
      <InstagramCard
        instagramDetails={{
          ...baseDetails,
          media: [{ type: "photo", url: "https://example.com/p.jpg" }],
        }}
        onClick={() => {}}
      />,
    );
    expect(
      screen.getByAltText("Instagram post by @oliverhamrin"),
    ).toBeInTheDocument();
    expect(screen.queryByText("From the archive")).not.toBeInTheDocument();
  });

  it("shows a placeholder when there is neither media nor caption", () => {
    render(
      <InstagramCard
        instagramDetails={{ ...baseDetails, caption: null }}
        onClick={() => {}}
      />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("Oliver Hamrin")).not.toBeInTheDocument();
  });
});
