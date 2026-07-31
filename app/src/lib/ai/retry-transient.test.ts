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

  test("recognised network/timeout errors are transient", () => {
    expect(isTransientAiError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientAiError({ name: "APIConnectionTimeoutError" })).toBe(
      true,
    );
    // fetch surfaces the real code on a nested cause
    expect(
      isTransientAiError({ name: "TypeError", cause: { code: "ETIMEDOUT" } }),
    ).toBe(true);
  });

  test("deterministic no-status errors are NOT transient (avoid re-burning tokens)", () => {
    // e.g. an OpenAI schema/length/content-filter parse failure
    expect(isTransientAiError({ name: "LengthFinishReasonError" })).toBe(false);
    expect(isTransientAiError(new Error("could not parse response"))).toBe(
      false,
    );
    expect(isTransientAiError({ code: "ENOSPC" })).toBe(false);
    expect(isTransientAiError(undefined)).toBe(false);
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
