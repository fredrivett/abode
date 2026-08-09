import { describe, expect, it } from "vitest";
import { extractInstagramPost } from "@/lib/html-metadata";

describe("extractInstagramPost", () => {
  it("extracts a bare post shortcode", () => {
    expect(
      extractInstagramPost("https://www.instagram.com/p/DbMJgxFiNTq/"),
    ).toEqual({ postId: "DbMJgxFiNTq", mediaType: "post" });
  });

  it("extracts a username-scoped post shortcode", () => {
    expect(
      extractInstagramPost(
        "https://www.instagram.com/oliverhamrin/p/DbMJgxFiNTq/",
      ),
    ).toEqual({ postId: "DbMJgxFiNTq", mediaType: "post" });
  });

  it("ignores query params like img_index", () => {
    expect(
      extractInstagramPost(
        "https://www.instagram.com/p/DbMJgxFiNTq/?img_index=1",
      ),
    ).toEqual({ postId: "DbMJgxFiNTq", mediaType: "post" });
  });

  it("classifies reels (singular and plural) as reel", () => {
    expect(
      extractInstagramPost("https://www.instagram.com/reel/AbC123_-x/"),
    ).toEqual({ postId: "AbC123_-x", mediaType: "reel" });
    expect(
      extractInstagramPost("https://www.instagram.com/reels/AbC123_-x/"),
    ).toEqual({ postId: "AbC123_-x", mediaType: "reel" });
  });

  it("classifies tv as tv", () => {
    expect(
      extractInstagramPost("https://www.instagram.com/tv/AbC123_-x/"),
    ).toEqual({ postId: "AbC123_-x", mediaType: "tv" });
  });

  it("returns null for profiles, stories, explore, and non-instagram URLs", () => {
    expect(
      extractInstagramPost("https://www.instagram.com/oliverhamrin/"),
    ).toBeNull();
    expect(
      extractInstagramPost("https://www.instagram.com/stories/foo/123/"),
    ).toBeNull();
    expect(
      extractInstagramPost("https://www.instagram.com/explore/tags/design/"),
    ).toBeNull();
    expect(
      extractInstagramPost("https://example.com/p/DbMJgxFiNTq/"),
    ).toBeNull();
  });

  it("rejects lookalike and path-embedded hostnames", () => {
    expect(
      extractInstagramPost("https://notinstagram.com/p/AbC123/"),
    ).toBeNull();
    expect(
      extractInstagramPost("https://example.com/instagram.com/p/AbC123/"),
    ).toBeNull();
    expect(extractInstagramPost("not a url")).toBeNull();
  });
});
