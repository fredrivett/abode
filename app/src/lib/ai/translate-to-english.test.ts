import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/embeddings", () => ({
  getOpenAiClient: vi.fn(),
  isOpenAiConfigured: vi.fn(),
}));
vi.mock("@/lib/ai-costs/record-ai-usage", () => ({ recordAiUsage: vi.fn() }));

import { recordAiUsage } from "@/lib/ai-costs/record-ai-usage";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/embeddings";
import { translateToEnglish } from "./translate-to-english";

const openaiConfigured = vi.mocked(isOpenAiConfigured);
const getClient = vi.mocked(getOpenAiClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("translateToEnglish", () => {
  it("returns the text unchanged and makes no API call when OpenAI is unconfigured", async () => {
    openaiConfigured.mockReturnValue(false);

    const result = await translateToEnglish("Hola mundo", { userId: "u1" });

    expect(result).toBe("Hola mundo");
    expect(getClient).not.toHaveBeenCalled();
    expect(recordAiUsage).not.toHaveBeenCalled();
  });

  it("translates via OpenAI when configured", async () => {
    openaiConfigured.mockReturnValue(true);
    const parse = vi.fn().mockResolvedValue({
      choices: [{ message: { parsed: { english: "Hello world" } } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
    getClient.mockReturnValue({
      chat: { completions: { parse } },
    } as unknown as ReturnType<typeof getOpenAiClient>);

    const result = await translateToEnglish("Hola mundo", { userId: "u1" });

    expect(result).toBe("Hello world");
    expect(parse).toHaveBeenCalled();
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai", operation: "translation" }),
    );
  });

  it("still records billed usage when the response has no parsed content, then throws", async () => {
    openaiConfigured.mockReturnValue(true);
    // A billed call that returns no parsed content — usage must still be
    // attributed (recorded before the parse guard) even though we throw.
    const parse = vi.fn().mockResolvedValue({
      choices: [{ message: { parsed: null } }],
      usage: { prompt_tokens: 7, completion_tokens: 4 },
    });
    getClient.mockReturnValue({
      chat: { completions: { parse } },
    } as unknown as ReturnType<typeof getOpenAiClient>);

    await expect(
      translateToEnglish("Hola mundo", { userId: "u1" }),
    ).rejects.toThrow();

    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        operation: "translation",
        inputTokens: 7,
        outputTokens: 4,
      }),
    );
  });
});
