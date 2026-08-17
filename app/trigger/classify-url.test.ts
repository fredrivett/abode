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

// Smallest valid PNG (1×1) — image-size must parse the favicon bytes, so a real
// image header is required, not arbitrary bytes.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function imageResponse(url: string) {
  const headers = {
    get: (k: string) => (k === "content-type" ? "image/png" : null),
  };
  return {
    ok: true,
    headers,
    url,
    arrayBuffer: async () => PNG_1x1,
  };
}

// A plain webpage (no og:image) that declares a favicon — reaches the favicon
// re-host branch because there's no cover to show.
const FAVICON_PAGE_URL = "https://example.com/page";
const FAVICON_PAGE_HTML =
  '<html><head><link rel="icon" href="/fav.png"></head><body>just some plain text, not an article</body></html>';

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

    // The whole point: the page DOM isn't re-fetched when the client already
    // captured it (favicon re-hosting may still fetch its own small URL).
    expect(mockSafeFetch).not.toHaveBeenCalledWith(
      ARTICLE_URL,
      expect.anything(),
    );
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

    // Page DOM not re-fetched; a favicon fetch to its own URL is allowed.
    expect(mockSafeFetch).not.toHaveBeenCalledWith(
      "https://example.com/page",
      expect.anything(),
    );
    expect(mockItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "webpage" }),
      }),
    );
    expect(mockArticleUpsert).not.toHaveBeenCalled();
  });
});

describe("classifyUrlTask — favicon re-hosting", () => {
  it("stores a re-hosted favicon for a webpage with no cover", async () => {
    // Only the favicon is fetched (page DOM is provided); return an image.
    mockSafeFetch.mockResolvedValue(
      imageResponse("https://example.com/fav.png"),
    );

    await run({
      itemId: "item_1",
      userId: "user_1",
      url: FAVICON_PAGE_URL,
      html: FAVICON_PAGE_HTML,
    });

    const { data } = mockItemUpdate.mock.calls[0][0];
    expect(data.kind).toBe("webpage");
    expect(typeof data.faviconFileKey).toBe("string");
    expect(data.faviconFileKey).toMatch(/^user_1\//);
  });

  it("leaves faviconFileKey null when the favicon isn't a usable image", async () => {
    // Favicon URL responds with HTML, not an image — must skip, not fail.
    mockSafeFetch.mockResolvedValue(
      htmlResponse("https://example.com/fav.png"),
    );

    await expect(
      run({
        itemId: "item_1",
        userId: "user_1",
        url: FAVICON_PAGE_URL,
        html: FAVICON_PAGE_HTML,
      }),
    ).resolves.toBeDefined();

    const { data } = mockItemUpdate.mock.calls[0][0];
    expect(data.kind).toBe("webpage");
    expect(data.faviconFileKey).toBeNull();
  });
});
