import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: vi.fn(),
}));

import { captureServerException, getPostHogClient } from "../posthog-server";
import {
  IMAGE_EMBEDDING_FAILED_EVENT,
  reportImageEmbeddingFailure,
} from "./embedding-failure";

const capture = vi.fn();
const client = vi.mocked(getPostHogClient);

beforeEach(() => {
  vi.clearAllMocks();
  capture.mockReset();
  // Minimal PostHog client shape — only capture() is used here
  client.mockReturnValue({ capture } as unknown as ReturnType<
    typeof getPostHogClient
  >);
});

describe("reportImageEmbeddingFailure", () => {
  it("emits a queryable event classifying a 429 as a throttle", () => {
    // Replicate ApiError shape: HTTP status lives on `.response.status`
    reportImageEmbeddingFailure({
      error: { response: { status: 429 } },
      userId: "user-1",
      itemId: "item-1",
      source: "tweet-cover",
      phase: "initial",
    });

    expect(capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: IMAGE_EMBEDDING_FAILED_EVENT,
      properties: {
        item_id: "item-1",
        source: "tweet-cover",
        phase: "initial",
        failure_kind: "throttle",
        status: 429,
      },
    });
  });

  it("classifies a non-rate-limit failure as an error with a null status", () => {
    reportImageEmbeddingFailure({
      error: new Error("boom"),
      userId: "user-1",
      itemId: "item-1",
      source: "upload",
      phase: "initial",
    });

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          failure_kind: "error",
          status: null,
        }),
      }),
    );
  });

  it("also captures the exception, with fileKey context when given", () => {
    const error = new Error("boom");
    reportImageEmbeddingFailure({
      error,
      userId: "user-1",
      itemId: "item-1",
      source: "tweet-cover",
      phase: "heal",
      fileKey: "items/cover.jpg",
    });

    expect(captureServerException).toHaveBeenCalledWith(
      error,
      "user-1",
      expect.objectContaining({
        source: "image-embedding:tweet-cover",
        itemId: "item-1",
        phase: "heal",
        failure_kind: "error",
        fileKey: "items/cover.jpg",
      }),
    );
  });

  it("never throws when a telemetry sink throws, and still tries the other", () => {
    capture.mockImplementation(() => {
      throw new Error("posthog down");
    });

    // Must not propagate — it runs inside a degraded-embedding catch
    expect(() =>
      reportImageEmbeddingFailure({
        error: new Error("boom"),
        userId: "user-1",
        itemId: "item-1",
        source: "upload",
        phase: "initial",
      }),
    ).not.toThrow();
    // A throwing event capture must not skip the exception capture
    expect(captureServerException).toHaveBeenCalled();
  });

  it("still captures the exception when PostHog is unavailable", () => {
    client.mockReturnValue(null);

    reportImageEmbeddingFailure({
      error: new Error("boom"),
      userId: "user-1",
      itemId: "item-1",
      source: "upload",
      phase: "initial",
    });

    expect(capture).not.toHaveBeenCalled();
    expect(captureServerException).toHaveBeenCalled();
  });
});
