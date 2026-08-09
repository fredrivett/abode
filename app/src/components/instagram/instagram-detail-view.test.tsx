import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstagramDetailView } from "./instagram-detail-view";
import type { InstagramDetails } from "./types";

const base: InstagramDetails = {
  postId: "DbMJgxFiNTq",
  mediaType: "post",
  authorName: "Oliver Hamrin",
  authorUsername: "oliverhamrin",
  caption: "From the archive",
  postedAt: null,
  media: [{ type: "photo", url: "https://example.com/p.jpg" }],
  likeCount: 66,
  commentCount: 0,
  coverMediaIndex: 0,
};

describe("InstagramDetailView", () => {
  it("renders author, caption, and the media image", () => {
    render(<InstagramDetailView instagramDetails={base} />);
    expect(screen.getByText("Oliver Hamrin")).toBeInTheDocument();
    expect(screen.getByText("@oliverhamrin")).toBeInTheDocument();
    expect(screen.getByText("From the archive")).toBeInTheDocument();
    expect(
      screen.getByAltText("Instagram post by @oliverhamrin"),
    ).toBeInTheDocument();
  });

  it("pluralizes like and comment counts", () => {
    render(
      <InstagramDetailView
        instagramDetails={{ ...base, likeCount: 66, commentCount: 0 }}
      />,
    );
    expect(screen.getByText("66 likes")).toBeInTheDocument();
    expect(screen.getByText("0 comments")).toBeInTheDocument();
  });

  it("uses singular labels for a count of one", () => {
    render(
      <InstagramDetailView
        instagramDetails={{ ...base, likeCount: 1, commentCount: 1 }}
      />,
    );
    expect(screen.getByText("1 like")).toBeInTheDocument();
    expect(screen.getByText("1 comment")).toBeInTheDocument();
  });

  it("omits the counts row when both counts are null", () => {
    render(
      <InstagramDetailView
        instagramDetails={{ ...base, likeCount: null, commentCount: null }}
      />,
    );
    expect(screen.queryByText(/likes?$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/comments?$/)).not.toBeInTheDocument();
  });

  it("links to the original post, preferring sourceUrl", () => {
    render(
      <InstagramDetailView
        instagramDetails={base}
        sourceUrl="https://www.instagram.com/oliverhamrin/p/DbMJgxFiNTq/"
      />,
    );
    const link = screen.getByRole("link", { name: /View on Instagram/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.instagram.com/oliverhamrin/p/DbMJgxFiNTq/",
    );
  });
});
