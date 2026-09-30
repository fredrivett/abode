import { describe, expect, it } from "vitest";
import { maskContentInUrl } from "./mask-url";

describe("maskContentInUrl", () => {
  it("masks search and shared-content query params, keeping others", () => {
    expect(
      maskContentInUrl(
        "https://abode.test/dashboard?q=therapy&sort=new&search=x#top",
        null,
      ),
    ).toBe(
      "https://abode.test/dashboard?q=<masked>&sort=new&search=<masked>#top",
    );
    expect(
      maskContentInUrl("/save?url=https%3A%2F%2Fexample.com&title=Hi", null),
    ).toBe("/save?url=<masked>&title=<masked>");
  });

  it("doesn't mistake a param that merely ends with a content name", () => {
    expect(maskContentInUrl("/x?faq=1&subtitle=2", null)).toBe(
      "/x?faq=1&subtitle=2",
    );
  });

  it("masks the signed-in user's own room slugs", () => {
    expect(
      maskContentInUrl("https://abode.test/@fred/private-plans?x=1", "fred"),
    ).toBe("https://abode.test/@fred/[room]?x=1");
  });

  it("keeps other people's (public) room paths", () => {
    expect(maskContentInUrl("https://abode.test/@alex/garden", "fred")).toBe(
      "https://abode.test/@alex/garden",
    );
  });

  it("keeps item pages and profiles", () => {
    expect(maskContentInUrl("/@fred/items/abc", "fred")).toBe(
      "/@fred/items/abc",
    );
    expect(maskContentInUrl("/@fred", "fred")).toBe("/@fred");
  });

  it("doesn't match a username that only shares a prefix", () => {
    expect(maskContentInUrl("/@freddie/room", "fred")).toBe("/@freddie/room");
  });

  it("leaves room paths alone when no one is signed in", () => {
    expect(maskContentInUrl("/@fred/plans", null)).toBe("/@fred/plans");
  });
});
