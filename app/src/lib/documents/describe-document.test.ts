import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../embeddings", () => ({
  getOpenAiClient: vi.fn(),
  isOpenAiConfigured: vi.fn(),
}));
vi.mock("../ai-costs/record-ai-usage", () => ({ recordAiUsage: vi.fn() }));

import { recordAiUsage } from "../ai-costs/record-ai-usage";
import { getOpenAiClient, isOpenAiConfigured } from "../embeddings";
import { describeDocument } from "./describe-document";

const parse = vi.fn();
const params = {
  text: "Order confirmation\nmous.co",
  userId: "u1",
  itemId: "i1",
};

const response = (parsed: unknown) => ({
  model: "gpt-4o-mini-2024-07-18",
  choices: [{ message: { parsed } }],
  usage: { prompt_tokens: 400, completion_tokens: 30 },
});

const promptOfCall = (call: number): string =>
  (parse.mock.calls[call][0] as { messages: { content: string }[] }).messages[0]
    .content;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isOpenAiConfigured).mockReturnValue(true);
  vi.mocked(getOpenAiClient).mockReturnValue({
    chat: { completions: { parse } },
  } as unknown as ReturnType<typeof getOpenAiClient>);
});

describe("describeDocument", () => {
  it("titles the document from its text and records the billed call", async () => {
    parse.mockResolvedValue(
      response({
        title: " Mous order confirmation ",
        description: "An order confirmation from Mous. ",
      }),
    );

    const result = await describeDocument(params);

    expect(result).toEqual({
      title: "Mous order confirmation",
      description: "An order confirmation from Mous.",
    });
    expect(promptOfCall(0)).toContain(
      "<document>\nOrder confirmation\nmous.co\n</document>",
    );
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        operation: "document_description",
        itemKind: "document",
        inputTokens: 400,
        outputTokens: 30,
      }),
    );
  });

  it("asks for the issuer by name rather than its web address", async () => {
    parse.mockResolvedValue(response({ title: "t", description: "d" }));
    await describeDocument(params);
    expect(promptOfCall(0)).toContain('"mous.co" → "Mous"');
  });

  it("sends only the start of a long document", async () => {
    parse.mockResolvedValue(response({ title: "t", description: "d" }));
    await describeDocument({ ...params, text: "word ".repeat(20_000) });
    expect(promptOfCall(0).length).toBeLessThan(20_000);
  });

  it("returns null without a call when OpenAI isn't configured", async () => {
    vi.mocked(isOpenAiConfigured).mockReturnValue(false);
    expect(await describeDocument(params)).toBeNull();
    expect(parse).not.toHaveBeenCalled();
    expect(recordAiUsage).not.toHaveBeenCalled();
  });

  it("still records usage, then throws, when no title comes back", async () => {
    parse.mockResolvedValue(response({ title: "  ", description: "d" }));
    await expect(describeDocument(params)).rejects.toThrow("No document title");
    expect(recordAiUsage).toHaveBeenCalledTimes(1);
  });
});
