import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VideoDetails } from "@/lib/types/item";
import { VideoCard } from "./video-card";

const baseVideo: VideoDetails = {
  platform: "vimeo",
  videoId: "125896742",
  channelName: "Cut Media",
  channelUrl: null,
  duration: 406,
  embedUrl: null,
  thumbnailUrl: "https://i.vimeocdn.com/video/abc.jpg",
};

describe("VideoCard", () => {
  it("falls back to the external thumbnail when there is no downloaded cover", () => {
    const { container } = render(
      <VideoCard
        videoDetails={baseVideo}
        coverFileKey={null}
        onClick={() => {}}
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", baseVideo.thumbnailUrl);
  });

  it("shows the platform placeholder when there is no thumbnail at all", () => {
    const { container } = render(
      <VideoCard
        videoDetails={{ ...baseVideo, thumbnailUrl: null }}
        coverFileKey={null}
        onClick={() => {}}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("does not render the channel name in the grid card", () => {
    render(
      <VideoCard
        videoDetails={baseVideo}
        coverFileKey={null}
        onClick={() => {}}
      />,
    );
    expect(screen.queryByText("Cut Media")).not.toBeInTheDocument();
  });
});
