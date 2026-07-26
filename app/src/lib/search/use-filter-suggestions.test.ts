import { act, renderHook } from "@testing-library/react";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FiltersResponse } from "./api";
import { useFilterSuggestions } from "./use-filter-suggestions";

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

const events = () =>
  vi.mocked(posthog.capture).mock.calls.map((call) => call[0]);

const OPTIONS: FiltersResponse = { color: ["orange"] };

function props(overrides: Record<string, unknown> = {}) {
  return {
    query: "orange",
    filterOptions: OPTIONS,
    filters: [],
    surface: "test",
    enabled: true,
    ...overrides,
  };
}

beforeEach(() => vi.mocked(posthog.capture).mockClear());

describe("useFilterSuggestions analytics funnel", () => {
  it("captures shown once when suggestions appear", () => {
    const { rerender } = renderHook((p) => useFilterSuggestions(p), {
      initialProps: props(),
    });
    expect(events()).toEqual(["search_suggestions_shown"]);
    rerender(props());
    expect(events()).toEqual(["search_suggestions_shown"]);
  });

  it("captures dismissed when a shown session ends with no accept", () => {
    const { rerender } = renderHook((p) => useFilterSuggestions(p), {
      initialProps: props(),
    });
    rerender(props({ enabled: false }));
    expect(events()).toEqual([
      "search_suggestions_shown",
      "search_suggestions_dismissed",
    ]);
  });

  it("does not dismiss a session that was accepted", () => {
    const { result, rerender } = renderHook((p) => useFilterSuggestions(p), {
      initialProps: props(),
    });
    act(() => result.current.markAccepted());
    rerender(props({ enabled: false }));
    expect(events()).toEqual(["search_suggestions_shown"]);
  });

  it("captures dismissed when the surface unmounts mid-session", () => {
    const { unmount } = renderHook((p) => useFilterSuggestions(p), {
      initialProps: props(),
    });
    unmount();
    expect(events()).toEqual([
      "search_suggestions_shown",
      "search_suggestions_dismissed",
    ]);
  });
});
