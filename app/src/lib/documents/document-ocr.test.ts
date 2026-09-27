import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../vision", () => ({
  isGoogleVisionConfigured: vi.fn(),
  detectDocumentText: vi.fn(),
}));
vi.mock("../embeddings", () => ({ isOpenAiConfigured: vi.fn() }));
vi.mock("../image-analysis/openai-vision", () => ({
  transcribeDocumentWithOpenAI: vi.fn(),
}));
vi.mock("../ai-costs/record-ai-usage", () => ({ recordAiUsage: vi.fn() }));
vi.mock("../posthog-server", () => ({ captureServerException: vi.fn() }));

import { recordAiUsage } from "../ai-costs/record-ai-usage";
import { isOpenAiConfigured } from "../embeddings";
import { transcribeDocumentWithOpenAI } from "../image-analysis/openai-vision";
import { captureServerException } from "../posthog-server";
import { detectDocumentText, isGoogleVisionConfigured } from "../vision";
import { extractPageText, isDocumentOcrConfigured } from "./document-ocr";

const page = {
  buffer: Buffer.from("jpeg"),
  mimeType: "image/jpeg",
  userId: "user-1",
  itemId: "item-1",
};

const configure = ({
  google,
  openai,
}: {
  google: boolean;
  openai: boolean;
}) => {
  vi.mocked(isGoogleVisionConfigured).mockReturnValue(google);
  vi.mocked(isOpenAiConfigured).mockReturnValue(openai);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(detectDocumentText).mockResolvedValue("Google text");
  vi.mocked(transcribeDocumentWithOpenAI).mockResolvedValue({
    text: "OpenAI text",
    truncated: false,
    usage: { promptTokens: 900, completionTokens: 300 },
    model: "gpt-4o-mini-2024-07-18",
  });
});

describe("extractPageText", () => {
  it("prefers Google Vision and records its usage", async () => {
    configure({ google: true, openai: true });
    await expect(extractPageText(page)).resolves.toEqual({
      text: "Google text",
      engine: "google_vision",
    });
    expect(transcribeDocumentWithOpenAI).not.toHaveBeenCalled();
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google_vision",
        operation: "document_ocr",
        model: "DOCUMENT_TEXT_DETECTION",
        itemKind: "document",
      }),
    );
  });

  it("uses OpenAI when Google isn't configured", async () => {
    configure({ google: false, openai: true });
    await expect(extractPageText(page)).resolves.toEqual({
      text: "OpenAI text",
      engine: "openai",
    });
    expect(detectDocumentText).not.toHaveBeenCalled();
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        operation: "document_ocr",
        inputTokens: 900,
        outputTokens: 300,
      }),
    );
  });

  it("falls back to OpenAI when Google errors, and reports the error", async () => {
    configure({ google: true, openai: true });
    vi.mocked(detectDocumentText).mockRejectedValue(new Error("quota"));
    await expect(extractPageText(page)).resolves.toEqual({
      text: "OpenAI text",
      engine: "openai",
    });
    expect(captureServerException).toHaveBeenCalledWith(
      expect.any(Error),
      "user-1",
      expect.objectContaining({ source: "document-ocr:google" }),
    );
  });

  it("returns no text, without throwing, when every service fails", async () => {
    configure({ google: true, openai: true });
    vi.mocked(detectDocumentText).mockRejectedValue(new Error("down"));
    vi.mocked(transcribeDocumentWithOpenAI).mockRejectedValue(
      new Error("down"),
    );
    await expect(extractPageText(page)).resolves.toEqual({
      text: null,
      engine: null,
    });
    expect(recordAiUsage).not.toHaveBeenCalled();
  });

  it("skips cleanly when no OCR service is configured", async () => {
    configure({ google: false, openai: false });
    await expect(extractPageText(page)).resolves.toEqual({
      text: null,
      engine: null,
    });
    expect(detectDocumentText).not.toHaveBeenCalled();
    expect(transcribeDocumentWithOpenAI).not.toHaveBeenCalled();
    expect(captureServerException).not.toHaveBeenCalled();
  });
});

describe("isDocumentOcrConfigured", () => {
  it.each([
    [{ google: true, openai: false }, true],
    [{ google: false, openai: true }, true],
    [{ google: false, openai: false }, false],
  ])("%j → %s", (services, expected) => {
    configure(services);
    expect(isDocumentOcrConfigured()).toBe(expected);
  });
});
