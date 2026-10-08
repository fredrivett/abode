import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  apiPost: vi.fn(),
  getUser: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  capture: vi.fn(),
  invalidate: vi.fn(),
  markComplete: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/lib/api-client", () => ({
  api: { post: m.apiPost },
  isDailyLimitError: () => false,
}));
vi.mock("@/lib/api-hooks", () => ({ useInvalidateItems: () => m.invalidate }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: m.getUser },
    storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: m.toastSuccess, error: m.toastError },
}));
// jsdom can't decode images; the preview is best-effort anyway
vi.mock("@/lib/image-preview", () => ({
  getImagePreview: async () => ({ width: 10, height: 10, blurDataUrl: null }),
}));
vi.mock("posthog-js", () => ({ default: { capture: m.capture } }));
vi.mock("@/lib/logger.client", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}));
vi.mock("@/stores/milestone-store", () => ({
  useMilestoneStore: { getState: () => ({ markComplete: m.markComplete }) },
}));

import { MAX_PDF_UPLOAD_BYTES } from "@/lib/uploads";
import { useUpload } from "./use-upload";

const pdf = (size = 2048, name = "Lease.pdf") => {
  const file = new File(["%PDF-1.7"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

async function uploadFile(file: File) {
  const { result } = renderHook(() => useUpload());
  let ok = false;
  await act(async () => {
    ok = await result.current.handleFileUpload(file, {
      source: "dialog_picker",
    });
  });
  return ok;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  m.upload.mockResolvedValue({ error: null });
  m.apiPost.mockResolvedValue({ id: "item-1" });
});

describe("useUpload with a PDF", () => {
  it("uploads it as a .pdf to the user's folder and saves it as a document", async () => {
    expect(await uploadFile(pdf())).toBe(true);

    const [key, , options] = m.upload.mock.calls[0];
    expect(key).toMatch(/^user-1\/[0-9a-f-]{36}\.pdf$/);
    expect(options).toEqual({ contentType: "application/pdf", upsert: false });
    expect(m.apiPost).toHaveBeenCalledWith("/api/v1/items/documents/pdf", {
      fileKey: key,
      originalName: "Lease.pdf",
      size: 2048,
    });
    expect(m.toastSuccess).toHaveBeenCalledWith(
      "PDF added — reading its pages",
    );
  });

  it("captures a pdf_uploaded event with where it came from", async () => {
    await uploadFile(pdf());
    expect(m.capture).toHaveBeenCalledWith("pdf_uploaded", {
      item_id: "item-1",
      file_size: 2048,
      source: "dialog_picker",
    });
  });

  it("doesn't mark the first-image milestone for a PDF", async () => {
    await uploadFile(pdf());
    expect(m.markComplete).not.toHaveBeenCalled();
  });

  it("rejects an oversized PDF before uploading, with a clear error", async () => {
    expect(await uploadFile(pdf(MAX_PDF_UPLOAD_BYTES + 1))).toBe(false);
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.toastError).toHaveBeenCalledWith(
      "PDF is too large. Max size is 25MB.",
    );
    expect(m.capture).toHaveBeenCalledWith("pdf_upload_rejected", {
      reason: "too_large",
      file_size: MAX_PDF_UPLOAD_BYTES + 1,
      source: "dialog_picker",
    });
  });

  it("removes the uploaded PDF when saving the document fails", async () => {
    m.apiPost.mockRejectedValue(new Error("500"));
    expect(await uploadFile(pdf())).toBe(false);
    expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0][0]]);
    expect(m.capture).not.toHaveBeenCalledWith(
      "pdf_uploaded",
      expect.anything(),
    );
  });

  it("still saves an image through the image route", async () => {
    const image = new File(["x"], "photo.png", { type: "image/png" });
    expect(await uploadFile(image)).toBe(true);
    expect(m.apiPost).toHaveBeenCalledWith(
      "/api/v1/items",
      expect.objectContaining({ kind: "image" }),
    );
    expect(m.markComplete).toHaveBeenCalledWith("upload_first_image");
  });
});
