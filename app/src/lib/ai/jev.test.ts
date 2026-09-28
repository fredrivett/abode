import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  articleDecisionFromProbability,
  isJevConfigured,
  judgeArticleVsWebpage,
} from "./jev";

const baseArgs = {
  title: "A Long Read",
  description: "An essay",
  content: "Sustained prose ".repeat(50),
  linkDensity: 0.05,
  longestParagraphWords: 120,
  wordCount: 900,
};

const fetchMock = vi.fn();

function jevResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("JEV_API_KEY", "jev-test");
  vi.stubEnv("JEV_BASE_URL", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isJevConfigured", () => {
  test("false without a key, true with one", () => {
    vi.stubEnv("JEV_API_KEY", undefined);
    expect(isJevConfigured()).toBe(false);
    vi.stubEnv("JEV_API_KEY", "jev-test");
    expect(isJevConfigured()).toBe(true);
  });
});

describe("articleDecisionFromProbability", () => {
  test("decisive above/below thresholds, null in the mid-band", () => {
    expect(articleDecisionFromProbability(0.9)).toBe("article");
    expect(articleDecisionFromProbability(0.7)).toBe("article"); // boundary
    expect(articleDecisionFromProbability(0.1)).toBe("webpage");
    expect(articleDecisionFromProbability(0.3)).toBe("webpage"); // boundary
    expect(articleDecisionFromProbability(0.5)).toBeNull();
    expect(articleDecisionFromProbability(0.69)).toBeNull();
  });
});

describe("judgeArticleVsWebpage", () => {
  test("returns NO_CALL and never fetches when unconfigured", async () => {
    vi.stubEnv("JEV_API_KEY", undefined);
    const result = await judgeArticleVsWebpage(baseArgs);
    expect(result).toEqual({
      decision: null,
      probability: null,
      usage: null,
      model: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("decides article from a high probability, parsing usage + model", async () => {
    fetchMock.mockResolvedValue(
      jevResponse({
        answers: { is_article: { noul: 0.88, confidence: 0.9 } },
        usage: { input_tokens: 420, output_tokens: 0 },
      }),
    );

    const result = await judgeArticleVsWebpage(baseArgs);

    expect(result.decision).toBe("article");
    expect(result.probability).toBe(0.88);
    expect(result.usage).toEqual({ inputTokens: 420, outputTokens: 0 });
    expect(result.model).toBe("jev-latest");
  });

  test("decides webpage from a low probability", async () => {
    fetchMock.mockResolvedValue(
      jevResponse({ answers: { is_article: { noul: 0.12 } } }),
    );
    const result = await judgeArticleVsWebpage(baseArgs);
    expect(result.decision).toBe("webpage");
    // usage defaults to zeros when the response omits it, but a call was billed
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  test("mid-band probability defers to the heuristic (decision null) but records the call", async () => {
    fetchMock.mockResolvedValue(
      jevResponse({
        answers: { is_article: { noul: 0.55 } },
        usage: { input_tokens: 100 },
      }),
    );
    const result = await judgeArticleVsWebpage(baseArgs);
    expect(result.decision).toBeNull();
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 0 });
  });

  test("falls back to NO_CALL on a non-OK response", async () => {
    fetchMock.mockResolvedValue(jevResponse({}, false, 503));
    const result = await judgeArticleVsWebpage(baseArgs);
    expect(result.decision).toBeNull();
    expect(result.usage).toBeNull();
  });

  test("falls back to NO_CALL on an unrecognised response shape", async () => {
    fetchMock.mockResolvedValue(jevResponse({ unexpected: true }));
    const result = await judgeArticleVsWebpage(baseArgs);
    expect(result.decision).toBeNull();
    expect(result.usage).toBeNull();
  });

  test("falls back to NO_CALL when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await judgeArticleVsWebpage(baseArgs);
    expect(result.decision).toBeNull();
    expect(result.usage).toBeNull();
  });

  test("targets the configured base URL with bearer auth", async () => {
    vi.stubEnv("JEV_BASE_URL", "https://openrouter.example/v1");
    fetchMock.mockResolvedValue(
      jevResponse({ answers: { is_article: { noul: 0.9 } } }),
    );

    await judgeArticleVsWebpage(baseArgs);

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://openrouter.example/v1/systemone");
    expect((init as RequestInit).method).toBe("POST");
    expect(
      (init as RequestInit).headers as Record<string, string>,
    ).toMatchObject({ Authorization: "Bearer jev-test" });
    // A stalled request must be abortable so classification can't hang on Jev.
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  test("falls back to the default base URL when JEV_BASE_URL is blank", async () => {
    // A copied `.env.example` yields `JEV_BASE_URL=""`; it must not post to a
    // relative `/systemone`.
    vi.stubEnv("JEV_BASE_URL", "");
    fetchMock.mockResolvedValue(
      jevResponse({ answers: { is_article: { noul: 0.9 } } }),
    );

    await judgeArticleVsWebpage(baseArgs);

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://api.typesafe.ai/v1/systemone");
  });
});
