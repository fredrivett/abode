import { describe, expect, it } from "vitest";
import { itemRunTags, itemTag, userTag } from "@/lib/items/run-tags";

describe("run-tags", () => {
  it("prefixes ids with their type per Trigger's convention", () => {
    expect(itemTag("abc")).toBe("item_abc");
    expect(userTag("u1")).toBe("user_u1");
  });

  it("combines item + user tags in a stable order", () => {
    expect(itemRunTags({ itemId: "abc", userId: "u1" })).toEqual([
      "item_abc",
      "user_u1",
    ]);
  });
});
