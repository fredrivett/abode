import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VideoDetails } from "@/lib/types/item";
import { VideoDetailView } from "./video-detail-view";

const baseVideo: VideoDetails = {
  platform: "vimeo",
  videoId: "125896742",
  channelName: "Cut Media",
  channelUrl: null,
  duration: 406,
  embedUrl: "https://player.vimeo.com/video/125896742",
  thumbnailUrl: "https://i.vimeocdn.com/video/abc.jpg",
};

describe("VideoDetailView", () => {
  it("uses the proxied cover when a downloaded cover exists", () => {
    const { container } = render(
      <VideoDetailView
        videoDetails={baseVideo}
        coverFileKey="covers/ridge.jpg"
        title="Danny Macaskill: The Ridge"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("covers%2Fridge.jpg");
  });

  it("falls back to the external thumbnail when there is no downloaded cover", () => {
    const { container } = render(
      <VideoDetailView
        videoDetails={baseVideo}
        coverFileKey={null}
        title="Danny Macaskill: The Ridge"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", baseVideo.thumbnailUrl);
  });

  it("shows the platform placeholder when there is no thumbnail at all", () => {
    const { container } = render(
      <VideoDetailView
        videoDetails={{ ...baseVideo, thumbnailUrl: null }}
        coverFileKey={null}
        title="Danny Macaskill: The Ridge"
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    // Play button is still rendered so the facade remains clickable
    expect(
      screen.getByRole("button", { name: "Play video" }),
    ).toBeInTheDocument();
  });
});
