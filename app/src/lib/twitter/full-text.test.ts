import { describe, expect, it, vi } from "vitest";
import { fetchFullTweetText } from "./full-text";

const TRUNCATED = "In the long run, the opportunities that are right for you";
const FULL = `${TRUNCATED} have a way of finding you. Stay in the game.`;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("fetchFullTweetText", () => {
  it("returns FxTwitter's full text and calls the status endpoint", async () => {
    const fetchFn = vi.fn(() =>
      jsonResponse({ tweet: { id: "1", text: FULL } }),
    );
    await expect(
      fetchFullTweetText({ tweetId: "1", truncatedText: TRUNCATED }, fetchFn),
    ).resolves.toBe(FULL);
    expect(fetchFn).toHaveBeenCalledWith("https://api.fxtwitter.com/status/1");
  });

  it("returns null when the text isn't longer than what we have", async () => {
    const fetchFn = () => jsonResponse({ tweet: { id: "1", text: TRUNCATED } });
    await expect(
      fetchFullTweetText({ tweetId: "1", truncatedText: TRUNCATED }, fetchFn),
    ).resolves.toBeNull();
  });

  it("returns null for a different tweet or a malformed body", async () => {
    await expect(
      fetchFullTweetText({ tweetId: "1", truncatedText: TRUNCATED }, () =>
        jsonResponse({ tweet: { id: "2", text: FULL } }),
      ),
    ).resolves.toBeNull();
    await expect(
      fetchFullTweetText({ tweetId: "1", truncatedText: TRUNCATED }, () =>
        jsonResponse({ code: 404, message: "NOT_FOUND" }),
      ),
    ).resolves.toBeNull();
  });

  it("throws on a non-OK response", async () => {
    await expect(
      fetchFullTweetText({ tweetId: "1", truncatedText: TRUNCATED }, () =>
        jsonResponse({}, 500),
      ),
    ).rejects.toThrow("FxTwitter responded 500");
  });
});
