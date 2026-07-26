import { beforeEach, describe, expect, test, vi } from "vitest";

const create = vi.fn();

// Stub the OpenAI SDK so `new OpenAI()` returns a client whose
// chat.completions.create is our mock.
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

import { selectProductImagesWithLLM } from "./openai-product-image-filter";

const baseArgs = {
  imageUrls: ["a", "b", "c"],
  productTitle: "Thing",
  domain: "example.com",
};

const response = (content: string) => ({
  model: "gpt-4.1-nano-2025-04-14",
  usage: { prompt_tokens: 100, completion_tokens: 5 },
  choices: [{ message: { content } }],
});

beforeEach(() => {
  create.mockReset();
  process.env.OPENAI_API_KEY = "sk-test";
});

describe("selectProductImagesWithLLM", () => {
  test("returns parsed indices with usage + model on success", async () => {
    create.mockResolvedValue(
      response(JSON.stringify({ productImageIndices: [0, 2] })),
    );

    const result = await selectProductImagesWithLLM(baseArgs);

    expect(result.indices).toEqual([0, 2]);
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 5 });
    expect(result.model).toBe("gpt-4.1-nano-2025-04-14");
  });

  test("preserves usage + model when parsing fails (billed but unparseable)", async () => {
    // Request succeeded (and was billed) but the body isn't valid JSON.
    create.mockResolvedValue(response("not json at all"));

    const result = await selectProductImagesWithLLM(baseArgs);

    // Falls back to all candidates, but the cost must still be reported.
    expect(result.indices).toEqual([0, 1, 2]);
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 5 });
    expect(result.model).toBe("gpt-4.1-nano-2025-04-14");
  });

  test("returns null usage when the request itself fails (no bill)", async () => {
    create.mockRejectedValue(new Error("network down"));

    const result = await selectProductImagesWithLLM(baseArgs);

    expect(result.indices).toEqual([0, 1, 2]);
    expect(result.usage).toBeNull();
    expect(result.model).toBeNull();
  });

  test("skips the API call entirely for a single candidate", async () => {
    const result = await selectProductImagesWithLLM({
      ...baseArgs,
      imageUrls: ["only-one"],
    });

    expect(result.indices).toEqual([0]);
    expect(result.usage).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
