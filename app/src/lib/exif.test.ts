import { beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import {
  extractExifCaptureDate,
  extractExifData,
  extractExifGpsLocation,
} from "./exif";

// Mock exifr module
vi.mock("exifr", () => ({
  gps: vi.fn(),
  parse: vi.fn(),
}));

// Mock logger
vi.mock("./logger.server", () => ({
  createLogger: () => ({
    debug: vi.fn(),
  }),
}));

// Import mocked exifr after mocking
import * as exifr from "exifr";

const mockGps = exifr.gps as Mock;
const mockParse = exifr.parse as Mock;

describe("extractExifGpsLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns GPS coordinates when valid data is present", async () => {
    mockGps.mockResolvedValue({ latitude: 37.7749, longitude: -122.4194 });

    const result = await extractExifGpsLocation(Buffer.from("test"));

    expect(result).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  });

  test("returns null when no GPS data is present", async () => {
    mockGps.mockResolvedValue(null);

    const result = await extractExifGpsLocation(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null for invalid latitude (out of range)", async () => {
    mockGps.mockResolvedValue({ latitude: 100, longitude: -122.4194 });

    const result = await extractExifGpsLocation(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null for invalid longitude (out of range)", async () => {
    mockGps.mockResolvedValue({ latitude: 37.7749, longitude: 200 });

    const result = await extractExifGpsLocation(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null for non-finite latitude", async () => {
    mockGps.mockResolvedValue({ latitude: Number.NaN, longitude: -122.4194 });

    const result = await extractExifGpsLocation(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null for non-finite longitude", async () => {
    mockGps.mockResolvedValue({
      latitude: 37.7749,
      longitude: Number.POSITIVE_INFINITY,
    });

    const result = await extractExifGpsLocation(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null when exifr throws an error", async () => {
    mockGps.mockRejectedValue(new Error("Parse error"));

    const result = await extractExifGpsLocation(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("handles boundary latitude values", async () => {
    // Valid at boundaries
    mockGps.mockResolvedValue({ latitude: 90, longitude: 0 });
    expect(await extractExifGpsLocation(Buffer.from("test"))).toEqual({
      latitude: 90,
      longitude: 0,
    });

    mockGps.mockResolvedValue({ latitude: -90, longitude: 0 });
    expect(await extractExifGpsLocation(Buffer.from("test"))).toEqual({
      latitude: -90,
      longitude: 0,
    });
  });

  test("handles boundary longitude values", async () => {
    mockGps.mockResolvedValue({ latitude: 0, longitude: 180 });
    expect(await extractExifGpsLocation(Buffer.from("test"))).toEqual({
      latitude: 0,
      longitude: 180,
    });

    mockGps.mockResolvedValue({ latitude: 0, longitude: -180 });
    expect(await extractExifGpsLocation(Buffer.from("test"))).toEqual({
      latitude: 0,
      longitude: -180,
    });
  });
});

describe("extractExifCaptureDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns DateTimeOriginal when present", async () => {
    const date = new Date("2024-06-15T10:30:00");
    mockParse.mockResolvedValue({ DateTimeOriginal: date });

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toEqual(date);
  });

  test("falls back to CreateDate when DateTimeOriginal is not present", async () => {
    const date = new Date("2024-06-15T10:30:00");
    mockParse.mockResolvedValue({ CreateDate: date });

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toEqual(date);
  });

  test("falls back to DateTimeDigitized when neither DateTimeOriginal nor CreateDate is present", async () => {
    const date = new Date("2024-06-15T10:30:00");
    mockParse.mockResolvedValue({ DateTimeDigitized: date });

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toEqual(date);
  });

  test("prefers DateTimeOriginal over CreateDate and DateTimeDigitized", async () => {
    const originalDate = new Date("2024-06-15T10:30:00");
    const createDate = new Date("2024-06-16T10:30:00");
    const digitizedDate = new Date("2024-06-17T10:30:00");
    mockParse.mockResolvedValue({
      DateTimeOriginal: originalDate,
      CreateDate: createDate,
      DateTimeDigitized: digitizedDate,
    });

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toEqual(originalDate);
  });

  test("returns null when no EXIF data is present", async () => {
    mockParse.mockResolvedValue(null);

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null when no date fields are present", async () => {
    mockParse.mockResolvedValue({ Make: "Canon", Model: "EOS R5" });

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null for invalid date (NaN)", async () => {
    mockParse.mockResolvedValue({ DateTimeOriginal: new Date("invalid") });

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null when date field is not a Date object", async () => {
    mockParse.mockResolvedValue({ DateTimeOriginal: "2024-06-15" });

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toBeNull();
  });

  test("returns null when exifr throws an error", async () => {
    mockParse.mockRejectedValue(new Error("Parse error"));

    const result = await extractExifCaptureDate(Buffer.from("test"));

    expect(result).toBeNull();
  });
});

describe("extractExifData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns both GPS and captureDate when present", async () => {
    const date = new Date("2024-06-15T10:30:00");
    mockParse.mockResolvedValue({
      latitude: 37.7749,
      longitude: -122.4194,
      DateTimeOriginal: date,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result).toEqual({
      gps: { latitude: 37.7749, longitude: -122.4194 },
      captureDate: date,
    });
  });

  test("returns only GPS when captureDate is not present", async () => {
    mockParse.mockResolvedValue({
      latitude: 37.7749,
      longitude: -122.4194,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result).toEqual({
      gps: { latitude: 37.7749, longitude: -122.4194 },
      captureDate: null,
    });
  });

  test("returns only captureDate when GPS is not present", async () => {
    const date = new Date("2024-06-15T10:30:00");
    mockParse.mockResolvedValue({
      DateTimeOriginal: date,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result).toEqual({
      gps: null,
      captureDate: date,
    });
  });

  test("returns nulls when no EXIF data is present", async () => {
    mockParse.mockResolvedValue(null);

    const result = await extractExifData(Buffer.from("test"));

    expect(result).toEqual({
      gps: null,
      captureDate: null,
    });
  });

  test("returns nulls when exifr returns empty object", async () => {
    mockParse.mockResolvedValue({});

    const result = await extractExifData(Buffer.from("test"));

    expect(result).toEqual({
      gps: null,
      captureDate: null,
    });
  });

  test("returns null GPS for invalid coordinates", async () => {
    const date = new Date("2024-06-15T10:30:00");
    mockParse.mockResolvedValue({
      latitude: 100, // Invalid
      longitude: -122.4194,
      DateTimeOriginal: date,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result).toEqual({
      gps: null,
      captureDate: date,
    });
  });

  test("returns null captureDate for invalid date", async () => {
    mockParse.mockResolvedValue({
      latitude: 37.7749,
      longitude: -122.4194,
      DateTimeOriginal: new Date("invalid"),
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result).toEqual({
      gps: { latitude: 37.7749, longitude: -122.4194 },
      captureDate: null,
    });
  });

  test("returns nulls when exifr throws an error", async () => {
    mockParse.mockRejectedValue(new Error("Parse error"));

    const result = await extractExifData(Buffer.from("test"));

    expect(result).toEqual({
      gps: null,
      captureDate: null,
    });
  });

  test("prefers DateTimeOriginal over other date fields", async () => {
    const originalDate = new Date("2024-06-15T10:30:00");
    const createDate = new Date("2024-06-16T10:30:00");
    mockParse.mockResolvedValue({
      latitude: 37.7749,
      longitude: -122.4194,
      DateTimeOriginal: originalDate,
      CreateDate: createDate,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result.captureDate).toEqual(originalDate);
  });

  test("falls back to CreateDate when DateTimeOriginal is not present", async () => {
    const createDate = new Date("2024-06-16T10:30:00");
    mockParse.mockResolvedValue({
      CreateDate: createDate,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result.captureDate).toEqual(createDate);
  });

  test("falls back to DateTimeDigitized when neither DateTimeOriginal nor CreateDate is present", async () => {
    const digitizedDate = new Date("2024-06-17T10:30:00");
    mockParse.mockResolvedValue({
      DateTimeDigitized: digitizedDate,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result.captureDate).toEqual(digitizedDate);
  });

  test("handles missing latitude with valid longitude", async () => {
    mockParse.mockResolvedValue({
      longitude: -122.4194,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result.gps).toBeNull();
  });

  test("handles missing longitude with valid latitude", async () => {
    mockParse.mockResolvedValue({
      latitude: 37.7749,
    });

    const result = await extractExifData(Buffer.from("test"));

    expect(result.gps).toBeNull();
  });
});
