import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../embeddings", () => ({ getOpenAiClient: vi.fn() }));

import { getOpenAiClient } from "../embeddings";
import {
  analyzeImageWithOpenAI,
  BilledVisionError,
  transcribeDocumentWithOpenAI,
} from "./openai-vision";

const create = vi.fn();

const analysis = {
  title: "Digital Skyline",
  description: "A skyline with data overlays.",
  tags: ["digital art"],
  objects: ["skyline"],
  ocrText: "ROT",
  dominantColors: [{ name: "black", hex: "#000000" }],
};

const completion = ({
  finishReason = "stop",
  content = JSON.stringify(analysis),
  completionTokens,
}: {
  finishReason?: "stop" | "length";
  content?: string;
  completionTokens: number;
}) => ({
  model: "gpt-4o-mini-2024-07-18",
  choices: [{ finish_reason: finishReason, message: { content } }],
  usage: {
    prompt_tokens: 800,
    completion_tokens: completionTokens,
    total_tokens: 800 + completionTokens,
  },
});

// What a runaway-OCR response looks like: cut off mid-string at max_tokens
const truncated = completion({
  finishReason: "length",
  content: '{"title":"Digital Skyline","ocrText":"ROT\\nC 0.000\\nC 0.000',
  completionTokens: 1000,
});

type CreateArgs = {
  messages: { content: { type: string; text?: string }[] }[];
};

const promptOfCall = (call: number): string => {
  const [args] = create.mock.calls[call] as [CreateArgs];
  return args.messages[0].content.find((c) => c.type === "text")?.text ?? "";
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOpenAiClient).mockReturnValue({
    chat: { completions: { create } },
  } as unknown as ReturnType<typeof getOpenAiClient>);
});

describe("analyzeImageWithOpenAI", () => {
  it("returns the analysis with OCR from a single call", async () => {
    create.mockResolvedValue(completion({ completionTokens: 250 }));

    const result = await analyzeImageWithOpenAI(Buffer.from("img"));

    expect(create).toHaveBeenCalledTimes(1);
    expect(promptOfCall(0)).toContain("Skip decorative, garbled");
    expect(result.analysis).toEqual(analysis);
    expect(result.usage).toEqual({
      promptTokens: 800,
      completionTokens: 250,
      totalTokens: 1050,
    });
  });

  it("retries without OCR when the response hits the length limit", async () => {
    create
      .mockResolvedValueOnce(truncated)
      .mockResolvedValueOnce(completion({ completionTokens: 200 }));

    const result = await analyzeImageWithOpenAI(Buffer.from("img"));

    expect(create).toHaveBeenCalledTimes(2);
    expect(promptOfCall(1)).toContain("ocrText: Always null");
    // Forced null even if the model ignores the instruction
    expect(result.analysis).toEqual({ ...analysis, ocrText: null });
  });

  it("reports usage for both calls when falling back, since both are billed", async () => {
    create
      .mockResolvedValueOnce(truncated)
      .mockResolvedValueOnce(completion({ completionTokens: 200 }));

    const result = await analyzeImageWithOpenAI(Buffer.from("img"));

    expect(result.usage).toEqual({
      promptTokens: 1600,
      completionTokens: 1200,
      totalTokens: 2800,
    });
  });

  it("throws when the no-OCR retry is also truncated", async () => {
    create.mockResolvedValue(truncated);

    await expect(analyzeImageWithOpenAI(Buffer.from("img"))).rejects.toThrow(
      "truncated even without OCR",
    );
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("skips OCR from the start when asked, in a single call", async () => {
    create.mockResolvedValue(completion({ completionTokens: 200 }));

    const result = await analyzeImageWithOpenAI(
      Buffer.from("img"),
      "image/jpeg",
      {
        ocr: false,
      },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(promptOfCall(0)).toContain("ocrText: Always null");
    // Forced null even if the model ignores the instruction
    expect(result.analysis).toEqual({ ...analysis, ocrText: null });
  });

  it("throws without a second call when a no-OCR request is truncated", async () => {
    create.mockResolvedValue(truncated);

    await expect(
      analyzeImageWithOpenAI(Buffer.from("img"), "image/jpeg", { ocr: false }),
    ).rejects.toThrow("truncated even without OCR");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("carries the billed usage of an unusable response on the error", async () => {
    create.mockResolvedValue(truncated);

    const error = await analyzeImageWithOpenAI(Buffer.from("img")).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(BilledVisionError);
    // Both the OCR attempt and the no-OCR retry were billed
    expect((error as BilledVisionError).billed).toEqual({
      model: "gpt-4o-mini-2024-07-18",
      usage: { promptTokens: 1600, completionTokens: 2000, totalTokens: 3600 },
    });
  });

  it("throws on a response that doesn't match the schema", async () => {
    create.mockResolvedValue(
      completion({ content: '{"title":"x"}', completionTokens: 5 }),
    );

    await expect(analyzeImageWithOpenAI(Buffer.from("img"))).rejects.toThrow(
      BilledVisionError,
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rethrows request errors without the no-OCR retry", async () => {
    create.mockRejectedValue(new Error("invalid image"));

    await expect(analyzeImageWithOpenAI(Buffer.from("img"))).rejects.toThrow(
      "invalid image",
    );
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("transcribeDocumentWithOpenAI", () => {
  const page = (finishReason: "stop" | "length", content: string | null) => ({
    model: "gpt-4o-mini-2024-07-18",
    choices: [{ finish_reason: finishReason, message: { content } }],
    usage: { prompt_tokens: 1100, completion_tokens: 700, total_tokens: 1800 },
  });

  it("returns the page's transcription with usage", async () => {
    create.mockResolvedValueOnce(page("stop", "  Dear Sir,\nThank you.  "));
    const result = await transcribeDocumentWithOpenAI(Buffer.from("x"));
    expect(result).toEqual({
      text: "Dear Sir,\nThank you.",
      truncated: false,
      usage: { promptTokens: 1100, completionTokens: 700 },
      model: "gpt-4o-mini-2024-07-18",
    });
  });

  it("asks for a verbatim transcription with a page-sized output budget", async () => {
    create.mockResolvedValueOnce(page("stop", "text"));
    await transcribeDocumentWithOpenAI(Buffer.from("x"));
    const [args] = create.mock.calls[0] as [{ max_tokens: number }];
    expect(args.max_tokens).toBeGreaterThanOrEqual(8000);
    expect(promptOfCall(0)).toMatch(/Transcribe all the text/);
  });

  it("keeps the partial text when a dense page overflows", async () => {
    create.mockResolvedValueOnce(page("length", "First half of the page"));
    const result = await transcribeDocumentWithOpenAI(Buffer.from("x"));
    expect(result.text).toBe("First half of the page");
    expect(result.truncated).toBe(true);
    // The truncated call is still billed
    expect(result.usage).toEqual({ promptTokens: 1100, completionTokens: 700 });
  });

  it("returns empty text for a page with none", async () => {
    create.mockResolvedValueOnce(page("stop", null));
    expect((await transcribeDocumentWithOpenAI(Buffer.from("x"))).text).toBe(
      "",
    );
  });
});
