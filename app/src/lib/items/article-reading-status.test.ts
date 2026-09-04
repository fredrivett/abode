import { ArticleReadingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ARTICLE_READING_STATUS_LABELS,
  ARTICLE_READING_STATUS_VALUES,
  articleReadingSchema,
  computeArticleReadingUpdate,
} from "./article-reading-status";

const NOW = new Date("2026-09-04T12:00:00.000Z");
const EARLIER = new Date("2026-09-01T09:00:00.000Z");

describe("ARTICLE_READING_STATUS_LABELS", () => {
  it("has a label for every status value", () => {
    for (const value of ARTICLE_READING_STATUS_VALUES) {
      expect(ARTICLE_READING_STATUS_LABELS[value]).toBeTruthy();
    }
  });
});

describe("articleReadingSchema", () => {
  it("accepts a status-only patch", () => {
    expect(articleReadingSchema.parse({ status: "read" })).toEqual({
      status: "read",
    });
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

  it("rejects an unknown status", () => {
    expect(articleReadingSchema.safeParse({ status: "skimmed" }).success).toBe(
      false,
    );
  });
});

describe("computeArticleReadingUpdate", () => {
  it("clears status and both timestamps on unread (keeps scroll position)", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { status: "unread" },
        current: {
          readingStatus: ArticleReadingStatus.read,
          startedAt: EARLIER,
          readAt: NOW,
        },
        now: NOW,
      }),
    ).toEqual({ readingStatus: null, startedAt: null, readAt: null });
  });

  it("stamps startedAt when advancing an unread article to reading", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { status: "reading" },
        current: null,
        now: NOW,
      }),
    ).toEqual({
      readingStatus: ArticleReadingStatus.reading,
      startedAt: NOW,
    });
  });

  it("preserves an existing startedAt when re-entering reading", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { status: "reading" },
        current: {
          readingStatus: ArticleReadingStatus.reading,
          startedAt: EARLIER,
          readAt: null,
        },
        now: NOW,
      }),
    ).toEqual({
      readingStatus: ArticleReadingStatus.reading,
      startedAt: EARLIER,
    });
  });

  it("never downgrades a read article back to reading", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { status: "reading" },
        current: {
          readingStatus: ArticleReadingStatus.read,
          startedAt: EARLIER,
          readAt: EARLIER,
        },
        now: NOW,
      }),
    ).toEqual({});
  });

  it("stamps readAt and backfills startedAt when marking read from unread", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { status: "read" },
        current: null,
        now: NOW,
      }),
    ).toEqual({
      readingStatus: ArticleReadingStatus.read,
      readAt: NOW,
      startedAt: NOW,
    });
  });

  it("preserves the original readAt/startedAt when already read", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { status: "read" },
        current: {
          readingStatus: ArticleReadingStatus.read,
          startedAt: EARLIER,
          readAt: EARLIER,
        },
        now: NOW,
      }),
    ).toEqual({
      readingStatus: ArticleReadingStatus.read,
      readAt: EARLIER,
      startedAt: EARLIER,
    });
  });

  it("updates scroll progress and stamps progressUpdatedAt without touching status", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { scrollProgress: 0.42 },
        current: {
          readingStatus: ArticleReadingStatus.reading,
          startedAt: EARLIER,
          readAt: null,
        },
        now: NOW,
      }),
    ).toEqual({ scrollProgress: 0.42, progressUpdatedAt: NOW });
  });

  it("applies status and scroll progress together", () => {
    expect(
      computeArticleReadingUpdate({
        patch: { status: "read", scrollProgress: 1 },
        current: null,
        now: NOW,
      }),
    ).toEqual({
      readingStatus: ArticleReadingStatus.read,
      readAt: NOW,
      startedAt: NOW,
      scrollProgress: 1,
      progressUpdatedAt: NOW,
    });
  });
});
