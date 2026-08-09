import { parseInstagramOg } from "@app/trigger/handle-instagram-url";
import { describe, expect, it } from "vitest";

const HTML = `
<html><head>
<meta property="og:title" content="Oliver Hamrin on Instagram: &quot;From the archive: The Year of the Horse&quot;" />
<meta property="og:description" content="66 likes, 0 comments - oliverhamrin on July 24, 2026: &quot;From the archive&quot;" />
<meta property="og:image" content="https://scontent.cdninstagram.com/v/t51/753954049.jpg?stp=c432" />
<meta property="og:url" content="https://www.instagram.com/oliverhamrin/p/DbMJgxFiNTq/" />
</head></html>`;

describe("parseInstagramOg", () => {
  it("parses author, caption, cover, and counts from OG tags", () => {
    const og = parseInstagramOg(
      HTML,
      "https://www.instagram.com/p/DbMJgxFiNTq/",
    );
    expect(og.authorUsername).toBe("oliverhamrin");
    expect(og.authorName).toBe("Oliver Hamrin");
    expect(og.caption).toBe("From the archive: The Year of the Horse");
    expect(og.coverImageUrl).toBe(
      "https://scontent.cdninstagram.com/v/t51/753954049.jpg?stp=c432",
    );
    expect(og.likeCount).toBe(66);
    expect(og.commentCount).toBe(0);
    // TZ-robust: the exact day can shift across timezones, but never the year.
    expect(og.postedAt).toBeTruthy();
    expect(new Date(og.postedAt as string).getUTCFullYear()).toBe(2026);
  });

  it("falls back to the og:url username when og:description lacks it", () => {
    const og = parseInstagramOg(
      '<meta property="og:url" content="https://www.instagram.com/someone/reel/AbC/" />',
      "https://www.instagram.com/reel/AbC/",
    );
    expect(og.authorUsername).toBe("someone");
  });

  it("returns all-null for an empty/login-gated shell", () => {
    const og = parseInstagramOg(
      "<html><head><title>Page Not Found</title></head></html>",
      "https://www.instagram.com/p/DbMJgxFiNTq/",
    );
    expect(og.authorUsername).toBeNull();
    expect(og.coverImageUrl).toBeNull();
    expect(og.caption).toBeNull();
    expect(og.likeCount).toBeNull();
  });
});
