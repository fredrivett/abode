import { afterEach, describe, expect, test, vi } from "vitest";
import { getAppBaseUrl } from "./url";

describe("getAppBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns localhost in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getAppBaseUrl()).toBe("http://localhost:3300");
  });

  test("returns localhost in test", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(getAppBaseUrl()).toBe("http://localhost:3300");
  });

  test("returns Vercel URL for preview deployments", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "my-app-abc123.vercel.app");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(getAppBaseUrl()).toBe("https://my-app-abc123.vercel.app");
  });

  test("returns production URL when VERCEL_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getAppBaseUrl()).toBe("https://www.abode.fyi");
  });

  test("returns production URL when no Vercel env vars", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_ENV", "");
    expect(getAppBaseUrl()).toBe("https://www.abode.fyi");
  });
});
