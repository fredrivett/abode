import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getAppBaseUrl } from "./url";

describe("getAppBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns localhost in development", () => {
    process.env.NODE_ENV = "development";
    expect(getAppBaseUrl()).toBe("http://localhost:3300");
  });

  test("returns localhost in test", () => {
    process.env.NODE_ENV = "test";
    expect(getAppBaseUrl()).toBe("http://localhost:3300");
  });

  test("uses Conductor port when provided", () => {
    process.env.NODE_ENV = "development";
    process.env.CONDUCTOR_PORT = "4567";
    expect(getAppBaseUrl()).toBe("http://localhost:4567");
  });

  test("returns Vercel URL for preview deployments", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_URL = "my-app-abc123.vercel.app";
    process.env.VERCEL_ENV = "preview";
    expect(getAppBaseUrl()).toBe("https://my-app-abc123.vercel.app");
  });

  test("returns production URL when VERCEL_ENV is production", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_URL = "my-app.vercel.app";
    process.env.VERCEL_ENV = "production";
    expect(getAppBaseUrl()).toBe("https://www.abode.fyi");
  });

  test("returns production URL when no Vercel env vars", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_URL = "";
    process.env.VERCEL_ENV = "";
    expect(getAppBaseUrl()).toBe("https://www.abode.fyi");
  });
});
