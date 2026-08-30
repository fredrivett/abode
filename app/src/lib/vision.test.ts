import { afterEach, describe, expect, test } from "vitest";
import { isGoogleVisionConfigured } from "./vision";

describe("isGoogleVisionConfigured", () => {
  const originalCreds = process.env.GOOGLE_CLOUD_CREDENTIALS;
  const originalPath = process.env.GOOGLE_CLOUD_CREDENTIALS_PATH;

  afterEach(() => {
    if (originalCreds === undefined)
      delete process.env.GOOGLE_CLOUD_CREDENTIALS;
    else process.env.GOOGLE_CLOUD_CREDENTIALS = originalCreds;
    if (originalPath === undefined)
      delete process.env.GOOGLE_CLOUD_CREDENTIALS_PATH;
    else process.env.GOOGLE_CLOUD_CREDENTIALS_PATH = originalPath;
  });

  test("true when inline credentials are set", () => {
    process.env.GOOGLE_CLOUD_CREDENTIALS = "{}";
    delete process.env.GOOGLE_CLOUD_CREDENTIALS_PATH;
    expect(isGoogleVisionConfigured()).toBe(true);
  });

  test("true when a credentials path is set", () => {
    delete process.env.GOOGLE_CLOUD_CREDENTIALS;
    process.env.GOOGLE_CLOUD_CREDENTIALS_PATH = "/tmp/creds.json";
    expect(isGoogleVisionConfigured()).toBe(true);
  });

  test("false when neither is set", () => {
    delete process.env.GOOGLE_CLOUD_CREDENTIALS;
    delete process.env.GOOGLE_CLOUD_CREDENTIALS_PATH;
    expect(isGoogleVisionConfigured()).toBe(false);
  });

  test("false when both are empty strings", () => {
    process.env.GOOGLE_CLOUD_CREDENTIALS = "";
    process.env.GOOGLE_CLOUD_CREDENTIALS_PATH = "";
    expect(isGoogleVisionConfigured()).toBe(false);
  });
});
