import { afterEach, describe, expect, it, vi } from "vitest";
import { viewSavedItemAction } from "./view-saved-item";

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

describe("viewSavedItemAction", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("opens the item's dialog on the dashboard without dropping the search", () => {
    window.history.replaceState(null, "", "/dashboard?type=note");

    viewSavedItemAction("item-1").onClick();

    expect(window.location.pathname).toBe("/dashboard");
    expect(window.location.search).toBe("?type=note&item=item-1");
  });
});
