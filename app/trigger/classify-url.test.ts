import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The classify-url task pulls in db, Supabase, the Trigger SDK, network fetches
// and every kind-specific handler. We mock the side-effecting edges and keep the
// pure classification logic (classifyItemKind + Readability signals) real, so
// these tests exercise the actual decision: does a provided rendered DOM replace
// the server-side fetch, and does URL-based kind detection still win?
const {
  mockSafeFetch,
  mockItemUpdate,
  mockArticleUpsert,
  mockTrigger,
  mockMarkProcessingActive,
  mockReclaim,
  mockDeleteReplaced,
  mockPruneStaleDetails,
  mockHandleVideoUrl,
  mockHandleTwitterUrl,
  mockHandleTwitterArticle,
  mockHandleInstagramUrl,
} = vi.hoisted(() => ({
  mockSafeFetch: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockArticleUpsert: vi.fn(),
  mockTrigger: vi.fn(),
  mockMarkProcessingActive: vi.fn(),
  mockReclaim: vi.fn(),
  mockDeleteReplaced: vi.fn(),
  mockPruneStaleDetails: vi.fn(),
  mockHandleVideoUrl: vi.fn(),
  mockHandleTwitterUrl: vi.fn(),
  mockHandleTwitterArticle: vi.fn(),
  mockHandleInstagramUrl: vi.fn(),
}));

// task() returns its config so `classifyUrlTask.run(payload)` is the real run fn.
vi.mock("@trigger.dev/sdk", () => ({
  task: (config: unknown) => config,
  tasks: { trigger: mockTrigger },
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }),
    },
  }),
}));

vi.mock("../src/lib/db", () => ({
  default: {
    item: { update: mockItemUpdate },
    itemArticleDetails: { upsert: mockArticleUpsert },
    itemBookDetails: { upsert: vi.fn() },
    itemProductDetails: { upsert: vi.fn() },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ item: { update: mockItemUpdate } }),
  },
}));

vi.mock("../src/lib/http/safe-fetch", () => ({ safeFetch: mockSafeFetch }));

vi.mock("../src/lib/items/mark-processing-active", () => ({
  markProcessingActive: mockMarkProcessingActive,
}));

vi.mock("./reclaim-item-storage", () => ({
  reclaimReplacedStorage: mockReclaim,
  deleteReplacedFiles: mockDeleteReplaced,
}));

vi.mock("../src/lib/item-details", () => ({
  pruneStaleItemDetails: mockPruneStaleDetails,
}));

vi.mock("../src/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
}));

vi.mock("../src/lib/ai/generate-tags-from-content", () => ({
  truncateToTokenLimit: (text: string) => text,
}));

vi.mock("../src/lib/ai-costs/record-ai-usage", () => ({
  recordAiUsage: vi.fn(),
}));

vi.mock("../src/lib/image-analysis/openai-product-image-filter", () => ({
  selectProductImagesWithLLM: vi.fn(),
}));

vi.mock("./handle-video-url", () => ({ handleVideoUrl: mockHandleVideoUrl }));
vi.mock("./handle-twitter-url", () => ({
  handleTwitterUrl: mockHandleTwitterUrl,
}));
vi.mock("./handle-twitter-article", () => ({
  handleTwitterArticle: mockHandleTwitterArticle,
}));
vi.mock("./handle-instagram-url", () => ({
  handleInstagramUrl: mockHandleInstagramUrl,
}));

import { classifyUrlTask } from "./classify-url";

// A real, metadata-less long-form essay (same fixture the article classifier
// tests use) — proven to classify as "article" via the prose fingerprint and to
// yield Readability content.
const ARTICLE_HTML = readFileSync(
  join(__dirname, "../src/lib/__fixtures__/article-paulgraham-essay.html"),
  "utf-8",
);
const ARTICLE_URL = "https://paulgraham.com/kids.html";

type TaskWithRun = {
  run: (payload: Record<string, unknown>) => Promise<unknown>;
};
const run = (payload: Record<string, unknown>) =>
  (classifyUrlTask as unknown as TaskWithRun).run(payload);

function htmlResponse(url: string, opts?: { method?: string }) {
  const headers = {
    get: (k: string) => (k === "content-type" ? "text/html" : null),
  };
  if (opts?.method === "HEAD") return { ok: true, headers, url };
  return { ok: true, headers, url, text: async () => ARTICLE_HTML };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  mockMarkProcessingActive.mockResolvedValue(undefined);
  mockItemUpdate.mockResolvedValue({});
  mockArticleUpsert.mockResolvedValue({});
  mockTrigger.mockResolvedValue({ id: "run_1" });
  mockReclaim.mockResolvedValue([]);
  mockDeleteReplaced.mockResolvedValue(undefined);
  mockPruneStaleDetails.mockResolvedValue(undefined);
  mockHandleVideoUrl.mockResolvedValue({
    success: true,
    itemId: "item_1",
    kind: "video",
  });
});

describe("classifyUrlTask — extension-provided rendered HTML", () => {
  it("classifies from provided HTML without any server-side fetch", async () => {
    await run({
      itemId: "item_1",
      userId: "user_1",
      url: ARTICLE_URL,
      html: ARTICLE_HTML,
    });

    // The whole point: no network fetch when the client already captured the DOM.
    expect(mockSafeFetch).not.toHaveBeenCalled();
    // Persisted as an article, derived from the provided HTML.
    expect(mockItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "article" }),
      }),
    );
    // Article body extracted and stored.
    expect(mockArticleUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockArticleUpsert.mock.calls[0][0];
    expect(typeof upsertArg.create.content).toBe("string");
    expect(upsertArg.create.content.length).toBeGreaterThan(0);
  });

  it("lets URL-based kind detection win over provided HTML (video)", async () => {
    await run({
      itemId: "item_1",
      userId: "user_1",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      html: ARTICLE_HTML,
    });

    // A YouTube URL routes to the video handler and ignores the captured HTML.
    expect(mockHandleVideoUrl).toHaveBeenCalledTimes(1);
    expect(mockSafeFetch).not.toHaveBeenCalled();
    expect(mockItemUpdate).not.toHaveBeenCalled();
    expect(mockArticleUpsert).not.toHaveBeenCalled();
  });

  it("falls back to a server-side fetch when no HTML is provided", async () => {
    mockSafeFetch.mockImplementation(async (url: string, opts?: unknown) =>
      htmlResponse(url, opts as { method?: string } | undefined),
    );

    await run({ itemId: "item_1", userId: "user_1", url: ARTICLE_URL });

    // Without a capture, the page is fetched server-side (unregressed behavior).
    expect(mockSafeFetch).toHaveBeenCalled();
    expect(mockItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "article" }),
      }),
    );
  });

  it("treats non-article provided HTML as a webpage without throwing", async () => {
    await expect(
      run({
        itemId: "item_1",
        userId: "user_1",
        url: "https://example.com/page",
        html: "<html><body>just some plain text, not an article</body></html>",
      }),
    ).resolves.toBeDefined();

    expect(mockSafeFetch).not.toHaveBeenCalled();
    expect(mockItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "webpage" }),
      }),
    );
    expect(mockArticleUpsert).not.toHaveBeenCalled();
  });
});
