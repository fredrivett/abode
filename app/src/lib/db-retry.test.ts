import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  isTransientConnectionError,
  retryTransientConnectionErrors,
} from "./db-retry";

const CLIENT_VERSION = "6.19.1";

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Error ${code}`, {
    code,
    clientVersion: CLIENT_VERSION,
  });
}

const unreachable = new Prisma.PrismaClientInitializationError(
  "Can't reach database server",
  CLIENT_VERSION,
);

describe("isTransientConnectionError", () => {
  it.each([
    ["an initialization error", unreachable],
    ["P1001 (can't reach server)", knownError("P1001")],
    ["P1002 (connect timed out)", knownError("P1002")],
    ["P2024 (pool timeout)", knownError("P2024")],
  ])("is true for %s", (_label, error) => {
    expect(isTransientConnectionError(error)).toBe(true);
  });

  it("is true for an initialization error reporting a transient code", () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server",
      CLIENT_VERSION,
      "P1001",
    );
    expect(isTransientConnectionError(error)).toBe(true);
  });

  it.each([
    [
      "an initialization error with a permanent code (P1000 bad credentials)",
      new Prisma.PrismaClientInitializationError(
        "Authentication failed",
        CLIENT_VERSION,
        "P1000",
      ),
    ],
    ["P1017 (connection closed — the query may have run)", knownError("P1017")],
    ["P2002 (unique constraint)", knownError("P2002")],
    ["a plain Error", new Error("boom")],
    ["a non-error", "boom"],
  ])("is false for %s", (_label, error) => {
    expect(isTransientConnectionError(error)).toBe(false);
  });
});

describe("retryTransientConnectionErrors", () => {
  const sleep = vi.fn(async () => {});

  it("returns the first successful result without retrying", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    await expect(
      retryTransientConnectionErrors(operation, { sleep }),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure with backoff until it succeeds", async () => {
    sleep.mockClear();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(unreachable)
      .mockRejectedValueOnce(knownError("P2024"))
      .mockResolvedValue("ok");

    await expect(
      retryTransientConnectionErrors(operation, {
        delaysMs: [10, 20],
        sleep,
      }),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it("rethrows the last transient error once retries run out", async () => {
    const lastError = knownError("P2024");
    const operation = vi
      .fn()
      .mockRejectedValueOnce(unreachable)
      .mockRejectedValueOnce(lastError);
    await expect(
      retryTransientConnectionErrors(operation, { delaysMs: [1], sleep }),
    ).rejects.toBe(lastError);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("never retries an error the database may already have acted on", async () => {
    const conflict = knownError("P2002");
    const operation = vi.fn().mockRejectedValue(conflict);
    await expect(
      retryTransientConnectionErrors(operation, { delaysMs: [1, 1], sleep }),
    ).rejects.toBe(conflict);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
