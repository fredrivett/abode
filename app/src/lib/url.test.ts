import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getAppBaseUrl } from "./url";

describe("getAppBaseUrl", () => {
  const originalEnv = process.env;

  const setEnv = (vars: Record<string, string | undefined>) => {
    process.env = { ...process.env, ...vars } as NodeJS.ProcessEnv;
  };

  beforeEach(() => {
    // Strip vars these tests exercise so nothing ambient (e.g. Conductor's
    // CONDUCTOR_PORT) leaks in and each test controls exactly what it sets
    const clean: Record<string, string | undefined> = { ...originalEnv };
    delete clean.CONDUCTOR_PORT;
    delete clean.VERCEL_URL;
    delete clean.VERCEL_ENV;
    delete clean.NODE_ENV;
    process.env = clean as NodeJS.ProcessEnv;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns localhost in development", () => {
    setEnv({ NODE_ENV: "development" });
    expect(getAppBaseUrl()).toBe("http://localhost:3300");
  });

  test("returns localhost in test", () => {
    setEnv({ NODE_ENV: "test" });
    expect(getAppBaseUrl()).toBe("http://localhost:3300");
  });

  test("uses Conductor port when provided", () => {
    setEnv({ NODE_ENV: "development", CONDUCTOR_PORT: "4567" });
    expect(getAppBaseUrl()).toBe("http://localhost:4567");
  });

  test("returns Vercel URL for preview deployments", () => {
    setEnv({
      NODE_ENV: "production",
      VERCEL_URL: "my-app-abc123.vercel.app",
      VERCEL_ENV: "preview",
    });
    expect(getAppBaseUrl()).toBe("https://my-app-abc123.vercel.app");
  });

  test("returns production URL when VERCEL_ENV is production", () => {
    setEnv({
      NODE_ENV: "production",
      VERCEL_URL: "my-app.vercel.app",
      VERCEL_ENV: "production",
    });
    expect(getAppBaseUrl()).toBe("https://www.abode.fyi");
  });

  test("returns production URL when no Vercel env vars", () => {
    setEnv({
      NODE_ENV: "production",
      VERCEL_URL: "",
      VERCEL_ENV: "",
    });
    expect(getAppBaseUrl()).toBe("https://www.abode.fyi");
  });
});
