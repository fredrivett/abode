import { describe, expect, it } from "vitest";
import {
  buildPostHogPersonReplaysUrl,
  getPostHogAppOrigin,
} from "./posthog-app-url";

describe("getPostHogAppOrigin", () => {
  it("maps PostHog Cloud ingestion hosts to the app host", () => {
    expect(getPostHogAppOrigin("https://us.i.posthog.com")).toBe(
      "https://us.posthog.com",
    );
    expect(getPostHogAppOrigin("https://eu.i.posthog.com/")).toBe(
      "https://eu.posthog.com",
    );
  });

  it("keeps a self-hosted origin as-is", () => {
    expect(getPostHogAppOrigin("https://posthog.example.com")).toBe(
      "https://posthog.example.com",
    );
  });

  it("rejects a host that isn't a URL", () => {
    expect(getPostHogAppOrigin("not a url")).toBeNull();
  });
});

describe("buildPostHogPersonReplaysUrl", () => {
  const config = {
    distinctId: "user-1",
    apiKey: "phc_test",
    host: "https://us.i.posthog.com",
    projectId: "123",
  };

  it("links to the person's recordings tab in the project", () => {
    expect(buildPostHogPersonReplaysUrl(config)).toBe(
      "https://us.posthog.com/project/123/person/user-1#activeTab=sessionRecordings",
    );
  });

  it("leaves the project to PostHog when no project ID is set", () => {
    expect(
      buildPostHogPersonReplaysUrl({ ...config, projectId: undefined }),
    ).toBe("https://us.posthog.com/person/user-1#activeTab=sessionRecordings");
  });

  it("falls back to posthog-js's default host", () => {
    expect(buildPostHogPersonReplaysUrl({ ...config, host: undefined })).toBe(
      "https://us.posthog.com/project/123/person/user-1#activeTab=sessionRecordings",
    );
  });

  it("returns null when PostHog isn't configured", () => {
    expect(
      buildPostHogPersonReplaysUrl({ ...config, apiKey: undefined }),
    ).toBeNull();
  });
});
