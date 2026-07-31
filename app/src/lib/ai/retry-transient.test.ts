import { describe, expect, test, vi } from "vitest";
import { isTransientAiError, retryTransient } from "./retry-transient";

const noSleep = () => Promise.resolve();

describe("isTransientAiError", () => {
  test("429 and 5xx are transient", () => {
    expect(isTransientAiError({ status: 429 })).toBe(true);
    expect(isTransientAiError({ status: 500 })).toBe(true);
    expect(isTransientAiError({ status: 503 })).toBe(true);
  });

  test("client errors (401/422) are not transient", () => {
    expect(isTransientAiError({ status: 401 })).toBe(false);
    expect(isTransientAiError({ status: 422 })).toBe(false);
  });

  test("errors with no status (network/timeout) are transient", () => {
    expect(isTransientAiError(new Error("socket hang up"))).toBe(true);
    expect(isTransientAiError(undefined)).toBe(true);
  });
});

describe("retryTransient", () => {
  test("returns the result without retrying on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(retryTransient(fn, { sleepFn: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries a transient error then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue("ok");
    await expect(retryTransient(fn, { sleepFn: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("gives up after the max attempts, throwing the last error", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 });
    await expect(
      retryTransient(fn, { sleepFn: noSleep, maxAttempts: 3 }),
    ).rejects.toEqual({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("does not retry a non-transient error", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 401 });
    await expect(retryTransient(fn, { sleepFn: noSleep })).rejects.toEqual({
      status: 401,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
