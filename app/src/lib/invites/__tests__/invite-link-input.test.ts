import { describe, expect, it } from "vitest";
import { getJoinPath, parseInviteLinkInput } from "../invite-link-input";

const TOKEN = "test-invite_1";

describe("parseInviteLinkInput", () => {
  it("takes the token from a full invite link", () => {
    expect(
      parseInviteLinkInput(`https://www.abode.fyi/join?token=${TOKEN}`),
    ).toEqual({ token: TOKEN, save: null });
  });

  it("keeps the shared item from a share invite link", () => {
    expect(
      parseInviteLinkInput(
        `https://www.abode.fyi/join?token=${TOKEN}&save=item-123`,
      ),
    ).toEqual({ token: TOKEN, save: "item-123" });
  });

  it("reads a link pasted without its scheme", () => {
    expect(parseInviteLinkInput(`abode.fyi/join?token=${TOKEN}`)).toEqual({
      token: TOKEN,
      save: null,
    });
  });

  it("reads a self-hosted instance's link", () => {
    expect(
      parseInviteLinkInput(`http://localhost:3000/join?save=x&token=${TOKEN}`),
    ).toEqual({ token: TOKEN, save: "x" });
  });

  it("ignores a fragment after the query", () => {
    expect(
      parseInviteLinkInput(`https://www.abode.fyi/join?token=${TOKEN}#top`),
    ).toEqual({ token: TOKEN, save: null });
  });

  it("accepts a bare token", () => {
    expect(parseInviteLinkInput(TOKEN)).toEqual({ token: TOKEN, save: null });
  });

  it("trims surrounding whitespace and newlines", () => {
    expect(
      parseInviteLinkInput(`  \nhttps://www.abode.fyi/join?token=${TOKEN} \n`),
    ).toEqual({ token: TOKEN, save: null });
    expect(parseInviteLinkInput(`  ${TOKEN}\t`)).toEqual({
      token: TOKEN,
      save: null,
    });
  });

  it("treats an empty save as no item", () => {
    expect(
      parseInviteLinkInput(`https://www.abode.fyi/join?token=${TOKEN}&save=`),
    ).toEqual({ token: TOKEN, save: null });
  });

  it.each([
    ["empty input", ""],
    ["whitespace only", "   "],
    ["a sentence", "my invite code"],
    ["an email address", "someone@example.com"],
    ["a link without a token", "https://www.abode.fyi/join"],
    ["a link with an empty token", "https://www.abode.fyi/join?token="],
    [
      "a link whose token has unexpected characters",
      "https://www.abode.fyi/join?token=abc%20def",
    ],
    ["a different page", "https://www.abode.fyi/login"],
  ])("rejects %s", (_label, input) => {
    expect(parseInviteLinkInput(input)).toBeNull();
  });
});

describe("getJoinPath", () => {
  it("links to the join page with the token", () => {
    expect(getJoinPath({ token: TOKEN, save: null })).toBe(
      `/join?token=${TOKEN}`,
    );
  });

  it("carries the shared item through", () => {
    expect(getJoinPath({ token: TOKEN, save: "item-123" })).toBe(
      `/join?token=${TOKEN}&save=item-123`,
    );
  });

  it("round-trips a parsed link", () => {
    const parts = parseInviteLinkInput(
      `https://www.abode.fyi/join?token=${TOKEN}&save=item-123`,
    );
    expect(parts && getJoinPath(parts)).toBe(
      `/join?token=${TOKEN}&save=item-123`,
    );
  });
});
