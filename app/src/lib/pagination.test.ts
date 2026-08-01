import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  isCanonicalUuid,
  MAX_PAGE_SIZE,
  parsePageSize,
} from "./pagination";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("parsePageSize", () => {
  it("returns the parsed value for a valid limit", () => {
    expect(parsePageSize("10")).toBe(10);
  });

  it("falls back to the default for non-numeric input", () => {
    expect(parsePageSize("abc")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("falls back to the default for null (missing param)", () => {
    expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("clamps values below 1 up to 1", () => {
    expect(parsePageSize("0")).toBe(1);
    expect(parsePageSize("-5")).toBe(1);
  });

  it("clamps values above the max down to the max", () => {
    expect(parsePageSize("1000")).toBe(MAX_PAGE_SIZE);
  });
});

describe("decodeCursor", () => {
  it("round-trips a valid cursor via encodeCursor", () => {
    const data = { createdAt: new Date().toISOString(), id: VALID_UUID };
    expect(decodeCursor(encodeCursor(data))).toEqual(data);
  });

  it("returns null for garbage base64 / non-JSON input", () => {
    expect(decodeCursor("!!!not-base64!!!")).toBeNull();
    expect(
      decodeCursor(Buffer.from("not json").toString("base64url")),
    ).toBeNull();
  });

  it("returns null for an empty object", () => {
    expect(decodeCursor(encode({}))).toBeNull();
  });

  it("returns null when fields are missing", () => {
    expect(
      decodeCursor(encode({ createdAt: new Date().toISOString() })),
    ).toBeNull();
    expect(decodeCursor(encode({ id: "abc-123" }))).toBeNull();
  });

  it("returns null when fields are the wrong type", () => {
    expect(decodeCursor(encode({ createdAt: 123, id: "abc-123" }))).toBeNull();
    expect(
      decodeCursor(encode({ createdAt: new Date().toISOString(), id: 5 })),
    ).toBeNull();
  });

  it("returns null when createdAt is not a valid date", () => {
    expect(
      decodeCursor(encode({ createdAt: "not-a-date", id: VALID_UUID })),
    ).toBeNull();
  });

  it("returns null when id is not a canonical UUID", () => {
    // ids are compared against a uuid column; a non-UUID would 500 the query
    expect(
      decodeCursor(
        encode({ createdAt: new Date().toISOString(), id: "abc-123" }),
      ),
    ).toBeNull();
  });
});

describe("isCanonicalUuid", () => {
  it("accepts a canonical UUID", () => {
    expect(isCanonicalUuid(VALID_UUID)).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isCanonicalUuid("abc-123")).toBe(false);
    expect(isCanonicalUuid("")).toBe(false);
    expect(isCanonicalUuid("123e4567e89b12d3a456426614174000")).toBe(false);
  });
});

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
