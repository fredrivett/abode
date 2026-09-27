import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinishedScanPage } from "@/lib/scanner/pages";

const m = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/dashboard",
  post: vi.fn(),
  getUser: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  invalidate: vi.fn(),
  preview: vi.fn(),
  isDailyLimitError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push }),
  usePathname: () => m.pathname,
}));
vi.mock("@/lib/api-client", () => ({
  api: { post: m.post },
  isDailyLimitError: m.isDailyLimitError,
}));
vi.mock("@/lib/api-hooks", () => ({ useInvalidateItems: () => m.invalidate }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: m.getUser },
    storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  }),
}));
vi.mock("@/lib/image-preview", () => ({ getImagePreview: m.preview }));
vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }));
vi.mock("@/lib/logger.client", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}));

import { useSaveScannedDocument } from "./use-save-scanned-document";

const USER = "user-1";

const page = (overrides: Partial<FinishedScanPage> = {}): FinishedScanPage => ({
  image: new Blob(["scan"], { type: "image/jpeg" }),
  original: new Blob(["colour!"], { type: "image/jpeg" }),
  filter: "bw",
  width: 1700,
  height: 2400,
  ...overrides,
});

function save(pages: FinishedScanPage[]) {
  const { result } = renderHook(() => useSaveScannedDocument());
  return result.current(pages);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.pathname = "/dashboard";
  m.getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  m.upload.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
  m.post.mockResolvedValue({ id: "item-1" });
  m.preview.mockResolvedValue({ blurDataUrl: "data:image/png;base64,b" });
  m.isDailyLimitError.mockReturnValue(false);
});

describe("useSaveScannedDocument", () => {
  it("uploads each page and its original into the user's folder, then saves the document", async () => {
    await expect(
      save([page(), page({ filter: "original", original: null })]),
    ).resolves.toBe(true);

    // Page 1: scan + original; page 2 is colour, so one file serves both
    expect(m.upload).toHaveBeenCalledTimes(3);
    for (const [key, , options] of m.upload.mock.calls) {
      expect(key).toMatch(new RegExp(`^${USER}/.+\\.jpg$`));
      expect(options).toEqual({ contentType: "image/jpeg", upsert: false });
    }

    const [url, body] = m.post.mock.calls[0];
    expect(url).toBe("/api/v1/items/documents");
    expect(body.blurDataUrl).toBe("data:image/png;base64,b");
    expect(body.pages).toHaveLength(2);
    expect(body.pages[0]).toMatchObject({
      filter: "bw",
      width: 1700,
      height: 2400,
      size: 4 + 7,
    });
    expect(body.pages[0].fileKey).not.toBe(body.pages[0].originalFileKey);
    expect(body.pages[1].originalFileKey).toBe(body.pages[1].fileKey);
    expect(m.success).toHaveBeenCalledWith("Document saved (2 pages)");
    expect(m.invalidate).toHaveBeenCalled();
  });

  it("removes the uploaded files and reports when saving fails", async () => {
    m.post.mockRejectedValue(new Error("500"));
    await expect(save([page()])).resolves.toBe(false);
    expect(m.remove).toHaveBeenCalledWith(
      m.upload.mock.calls.map(([key]) => key),
    );
    expect(m.error).toHaveBeenCalledWith(
      "Couldn't save the document. Please try again.",
    );
  });

  it("removes what was uploaded when a later upload fails", async () => {
    m.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("quota") });
    await expect(save([page()])).resolves.toBe(false);
    expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0][0]]);
    expect(m.post).not.toHaveBeenCalled();
  });

  it("explains the daily limit when it's reached", async () => {
    m.post.mockRejectedValue(new Error("429"));
    m.isDailyLimitError.mockReturnValue(true);
    await save([page()]);
    expect(m.error).toHaveBeenCalledWith(expect.stringMatching(/daily limit/i));
  });

  it("still saves when the blur placeholder can't be made", async () => {
    m.preview.mockRejectedValue(new Error("decode"));
    await expect(save([page()])).resolves.toBe(true);
    expect(m.post.mock.calls[0][1].blurDataUrl).toBeUndefined();
  });

  it("takes you to the dashboard when saved from elsewhere", async () => {
    m.pathname = "/rooms/abc";
    await save([page()]);
    expect(m.push).toHaveBeenCalledWith("/dashboard");
    expect(m.invalidate).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    m.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(save([page()])).resolves.toBe(false);
    expect(m.upload).not.toHaveBeenCalled();
  });
});
