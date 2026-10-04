import { afterEach, describe, expect, it } from "vitest";
import {
  ANY_ROOM_OWNER,
  getRoomMaskScope,
  resetAnalyticsUsername,
  setAnalyticsUsername,
} from "./analytics-username";

const AUTH_COOKIE = "sb-127-auth-token";

function setCookie(value: string, maxAge: number) {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom test fixture
  document.cookie = `${AUTH_COOKIE}=${value}; path=/; max-age=${maxAge}`;
}

describe("getRoomMaskScope", () => {
  afterEach(() => {
    resetAnalyticsUsername();
    setCookie("", 0);
  });

  it("masks no rooms for a signed-out visitor", () => {
    expect(getRoomMaskScope()).toBeNull();
  });

  it("masks every room while a session exists but the user is unconfirmed", () => {
    setCookie("base64-abc", 60);
    expect(getRoomMaskScope()).toBe(ANY_ROOM_OWNER);
  });

  it("masks only the confirmed user's rooms", () => {
    setCookie("base64-abc", 60);
    setAnalyticsUsername("fred");
    expect(getRoomMaskScope()).toBe("fred");
  });

  it("masks none once sign-out is confirmed", () => {
    setCookie("base64-abc", 60);
    setAnalyticsUsername(null);
    expect(getRoomMaskScope()).toBeNull();
  });
});
