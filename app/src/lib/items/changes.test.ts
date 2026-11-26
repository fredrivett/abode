import { describe, expect, it } from "vitest";
import {
  CHANGES_REREAD_MS,
  decodeChangesCursor,
  encodeChangesCursor,
  finishedRoundCursor,
} from "./changes";

const NOW = Date.parse("2026-11-26T12:00:00.000Z");
const ID = "7f000000-0000-4000-8000-000000000001";

describe("finishedRoundCursor", () => {
  it("keeps where the round got to when that's older than the reread window", () => {
    const reached = {
      updatedAt: new Date(NOW - CHANGES_REREAD_MS - 1).toISOString(),
      id: ID,
    };
    expect(finishedRoundCursor({ reached, now: NOW })).toEqual(reached);
  });

  it("steps back to the window's start, before every id, when the round got past it", () => {
    const reached = { updatedAt: new Date(NOW - 1000).toISOString(), id: ID };
    expect(finishedRoundCursor({ reached, now: NOW })).toEqual({
      updatedAt: new Date(NOW - CHANGES_REREAD_MS).toISOString(),
      id: "00000000-0000-0000-0000-000000000000",
    });
  });

  it("starts at the window when an empty library gives nothing to reach", () => {
    expect(finishedRoundCursor({ reached: null, now: NOW }).updatedAt).toBe(
      new Date(NOW - CHANGES_REREAD_MS).toISOString(),
    );
  });
});

describe("changes cursor", () => {
  it("round-trips, and rejects anything it didn't encode", () => {
    const cursor = { updatedAt: "2026-01-01T00:00:00.000Z", id: ID };
    expect(decodeChangesCursor(encodeChangesCursor(cursor))).toEqual(cursor);
    expect(decodeChangesCursor("not-a-cursor")).toBeNull();
    expect(
      decodeChangesCursor(
        encodeChangesCursor({ updatedAt: "2026-01-01", id: "1 OR 1=1" }),
      ),
    ).toBeNull();
  });
});
