import { afterEach, describe, expect, test, vi } from "vitest";
import { getAppBaseUrl } from "./url";

describe("getAppBaseUrl", () => {
  const setEnv = (vars: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(vars)) {
      vi.stubEnv(key, value);
    }
  };

  afterEach(() => {
    vi.unstubAllEnvs();
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
