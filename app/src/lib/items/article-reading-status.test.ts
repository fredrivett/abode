import { describe, expect, it } from "vitest";
import {
  articleReadingSchema,
  computeArticleReadingUpdate,
} from "./article-reading-status";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const EARLIER = new Date("2026-09-01T09:00:00.000Z");

describe("articleReadingSchema", () => {
  it("accepts a read-only patch", () => {
    expect(articleReadingSchema.parse({ read: true })).toEqual({ read: true });
  });

  it("accepts a scrollProgress-only patch", () => {
    expect(articleReadingSchema.parse({ scrollProgress: 0.5 })).toEqual({
      scrollProgress: 0.5,
    });
  });

  it("rejects scrollProgress outside 0..1", () => {
    expect(
      articleReadingSchema.safeParse({ scrollProgress: 1.5 }).success,
    ).toBe(false);
    expect(
      articleReadingSchema.safeParse({ scrollProgress: -0.1 }).success,
    ).toBe(false);
  });
});

describe("computeArticleReadingUpdate", () => {
  it("stamps readAt when marking an unread article read", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { read: true },
        current: null,
        now: NOW,
      }),
    ).toEqual({ readAt: NOW });
  });

  it("preserves the original readAt when re-confirming a read article", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { read: true },
        current: { readAt: EARLIER },
        now: NOW,
      }),
    ).toEqual({ readAt: EARLIER });
  });

  it("clears readAt when marking unread (keeps scroll position)", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { read: false },
        current: { readAt: EARLIER },
        now: NOW,
      }),
    ).toEqual({ readAt: null });
  });

  it("updates scroll progress and stamps progressUpdatedAt without touching read", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { scrollProgress: 0.42 },
        current: { readAt: null },
        now: NOW,
      }),
    ).toEqual({ scrollProgress: 0.42, progressUpdatedAt: NOW });
  });

  it("applies read and scroll progress together", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { read: true, scrollProgress: 1 },
        current: null,
        now: NOW,
      }),
    ).toEqual({ readAt: NOW, scrollProgress: 1, progressUpdatedAt: NOW });
  });

  it("does nothing for an empty patch", () => {
    expect(
      computeArticleReadingUpdate({
        patch: {},
        current: { readAt: EARLIER },
        now: NOW,
      }),
    ).toEqual({});
  });
});
