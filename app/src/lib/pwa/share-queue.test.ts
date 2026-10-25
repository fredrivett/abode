import { describe, expect, it } from "vitest";
import {
  CLEAR_SHARE_QUEUE_MESSAGE,
  isClearShareQueueMessage,
  isReplayShareQueueMessage,
  queuedSaveRequest,
  REPLAY_SHARE_QUEUE_MESSAGE,
  sharedUrlFromSaveUrl,
  shouldRetryReplayedSave,
} from "./share-queue";

const ORIGIN = "https://abode.test";

describe("sharedUrlFromSaveUrl", () => {
  it("reads the shared link", () => {
    const url = new URL(
      `/save?url=${encodeURIComponent("https://a.com/x")}`,
      ORIGIN,
    );
    expect(sharedUrlFromSaveUrl(url)).toBe("https://a.com/x");
  });

  it("finds a link shared as text, as Android apps often do", () => {
    const url = new URL(
      `/save?text=${encodeURIComponent("look https://a.com/x")}`,
      ORIGIN,
    );
    expect(sharedUrlFromSaveUrl(url)).toBe("https://a.com/x");
  });

  it("ignores other pages and shares without a link", () => {
    expect(
      sharedUrlFromSaveUrl(new URL("/dashboard?url=https://a.com", ORIGIN)),
    ).toBeNull();
    expect(
      sharedUrlFromSaveUrl(new URL("/save?text=hello", ORIGIN)),
    ).toBeNull();
  });
});

describe("queuedSaveRequest", () => {
  it("builds the same save the share page makes", async () => {
    const request = queuedSaveRequest({
      origin: ORIGIN,
      sharedUrl: "https://a.com/x",
    });
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${ORIGIN}/api/v1/items/from-url`);
    expect(await request.json()).toEqual({
      url: "https://a.com/x",
      source: "share_target",
    });
  });
});

describe("isReplayShareQueueMessage", () => {
  it("recognises only the replay message", () => {
    expect(isReplayShareQueueMessage(REPLAY_SHARE_QUEUE_MESSAGE)).toBe(true);
    expect(isReplayShareQueueMessage({ type: "SKIP_WAITING" })).toBe(false);
    expect(isReplayShareQueueMessage("replay-share-queue")).toBe(false);
    expect(isReplayShareQueueMessage(null)).toBe(false);
    expect(isReplayShareQueueMessage(CLEAR_SHARE_QUEUE_MESSAGE)).toBe(false);
  });

  it("tells the clear message apart", () => {
    expect(isClearShareQueueMessage(CLEAR_SHARE_QUEUE_MESSAGE)).toBe(true);
    expect(isClearShareQueueMessage(REPLAY_SHARE_QUEUE_MESSAGE)).toBe(false);
  });
});

describe("shouldRetryReplayedSave", () => {
  it.each([
    [201, false],
    [200, false],
    [400, false],
    [401, true],
    [429, true],
    [500, true],
    [503, true],
  ])("%s → %s", (status, expected) => {
    expect(shouldRetryReplayedSave(status)).toBe(expected);
  });
});
