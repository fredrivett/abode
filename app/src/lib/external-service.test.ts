import { describe, expect, it, vi } from "vitest";
import { withExternalService } from "@/lib/external-service";

describe("withExternalService", () => {
  it("skips cleanly when not configured — never invokes run (no setup work)", async () => {
    const run = vi.fn();
    const onError = vi.fn();

    const result = await withExternalService({
      isConfigured: false,
      run,
      onSkip: () => "skipped",
      onError,
    });

    expect(result).toBe("skipped");
    expect(run).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("evaluates a predicate for isConfigured and skips when it returns false", async () => {
    const run = vi.fn();

    const result = await withExternalService({
      isConfigured: () => false,
      run,
      onSkip: () => "skipped",
      onError: () => "errored",
    });

    expect(result).toBe("skipped");
    expect(run).not.toHaveBeenCalled();
  });

  it("returns run() when configured and it succeeds", async () => {
    const onSkip = vi.fn();
    const onError = vi.fn();

    const result = await withExternalService({
      isConfigured: true,
      run: async () => "ran",
      onSkip,
      onError,
    });

    expect(result).toBe("ran");
    expect(onSkip).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("runs when isConfigured is the predicate returning true", async () => {
    const result = await withExternalService({
      isConfigured: () => true,
      run: () => "ran",
      onSkip: () => "skipped",
      onError: () => "errored",
    });

    expect(result).toBe("ran");
  });

  it("catches a thrown error and returns onError(error) instead of propagating", async () => {
    const boom = new Error("boom");
    const onError = vi.fn((error: unknown) => {
      expect(error).toBe(boom);
      return "recovered";
    });

    const result = await withExternalService({
      isConfigured: true,
      run: () => {
        throw boom;
      },
      onSkip: () => "skipped",
      onError,
    });

    expect(result).toBe("recovered");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("catches a rejected promise the same way as a synchronous throw", async () => {
    const boom = new Error("async boom");

    const result = await withExternalService({
      isConfigured: true,
      run: async () => {
        throw boom;
      },
      onSkip: () => "skipped",
      onError: (error) => (error === boom ? "recovered" : "wrong-error"),
    });

    expect(result).toBe("recovered");
  });
});
