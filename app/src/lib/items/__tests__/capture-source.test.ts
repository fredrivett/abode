/// <reference types="vitest/globals" />

import type { AuthenticatedRequest } from "@/lib/auth/authenticate-request";
import {
  captureAttribution,
  captureSourceLabel,
  isItemSource,
} from "../capture-source";

describe("isItemSource", () => {
  test.each(["web", "share_target", "extension"])(
    "accepts the valid source %s",
    (value) => {
      expect(isItemSource(value)).toBe(true);
    },
  );

  // `api` is a real CaptureSource but only ever stamped server-side
  test.each([null, undefined, "", "twitter", "WEB", "api", 42, {}])(
    "rejects the invalid value %p",
    (value) => {
      expect(isItemSource(value)).toBe(false);
    },
  );
});

describe("captureSourceLabel", () => {
  test.each([
    ["web", "Web"],
    ["share_target", "Shared"],
    ["extension", "Extension"],
    ["api", "API"],
  ] as const)("labels %s as %s", (source, label) => {
    expect(captureSourceLabel(source)).toBe(label);
  });
});

describe("captureAttribution", () => {
  const user = { id: "u1" } as AuthenticatedRequest["user"];

  it("stamps a token save as api with the token id, ignoring the client's claim", () => {
    const auth: AuthenticatedRequest = {
      user,
      method: "pat",
      tokenId: "tok_1",
    };
    expect(captureAttribution(auth, "extension")).toEqual({
      captureSource: "api",
      personalAccessTokenId: "tok_1",
    });
  });

  it("keeps a session's self-reported source, with no token", () => {
    const auth: AuthenticatedRequest = { user, method: "bearer" };
    expect(captureAttribution(auth, "extension")).toEqual({
      captureSource: "extension",
      personalAccessTokenId: null,
    });
  });

  it("falls back to web for a session with no or an invalid source", () => {
    const auth: AuthenticatedRequest = { user, method: "cookie" };
    expect(captureAttribution(auth, undefined).captureSource).toBe("web");
    // A session can't claim to be a token save
    expect(captureAttribution(auth, "api")).toEqual({
      captureSource: "web",
      personalAccessTokenId: null,
    });
  });
});
