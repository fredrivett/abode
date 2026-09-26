import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  callerStack,
  diffSearchParams,
  instrumentHistory,
} from "./instrument-history";
import { resetTrace, traceNames } from "./test-utils";
import { getTraceEvents } from "./trace";

describe("diffSearchParams", () => {
  it("reports added, removed, and changed keys", () => {
    expect(
      diffSearchParams({
        from: "?item=a&q=cats&x=1",
        to: "?q=dogs&x=1&sort=new",
      }),
    ).toEqual({ added: ["sort"], removed: ["item"], changed: ["q"] });
  });

  it("is empty when nothing changed", () => {
    expect(diffSearchParams({ from: "?a=1", to: "?a=1" })).toEqual({
      added: [],
      removed: [],
      changed: [],
    });
  });
});

describe("callerStack", () => {
  it("drops the Error header and the wrapper frame", () => {
    const stack = [
      "Error",
      "    at patched (instrument-history.ts:1:1)",
      "    at writeUrl (use-search.ts:66:5)",
      "    at onClick (item-card.tsx:1412:3)",
    ].join("\n");
    expect(callerStack(stack)).toEqual([
      "at writeUrl (use-search.ts:66:5)",
      "at onClick (item-card.tsx:1412:3)",
    ]);
  });

  it("caps depth and tolerates a missing stack", () => {
    const stack = [
      "Error",
      ...Array.from({ length: 10 }, (_, i) => `at f${i}`),
    ].join("\n");
    expect(callerStack(stack, 2)).toEqual(["at f1", "at f2"]);
    expect(callerStack(undefined)).toEqual([]);
  });
});

describe("instrumentHistory", () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    window.history.replaceState(null, "", "/dashboard");
    resetTrace();
    uninstall = instrumentHistory();
  });

  afterEach(() => {
    uninstall();
    resetTrace({ enabled: false });
  });

  it("records pushState with the param diff and a stack", () => {
    window.history.pushState(null, "", "?item=abc");
    const [event] = getTraceEvents();
    expect(event.channel).toBe("url");
    expect(event.event).toBe("pushState");
    expect(event.data).toMatchObject({
      from: "/dashboard",
      to: "/dashboard?item=abc",
      added: ["item"],
    });
    expect(Array.isArray(event.data?.stack)).toBe(true);
  });

  it("flags a replaceState that drops a param", () => {
    window.history.replaceState(null, "", "/dashboard?item=abc&q=cats");
    window.history.replaceState(null, "", "/dashboard?q=cats");
    expect(getTraceEvents().at(-1)?.data).toMatchObject({ removed: ["item"] });
  });

  it("ignores a replaceState that keeps the same URL", () => {
    window.history.replaceState({ internal: true }, "", "/dashboard");
    window.history.replaceState({ internal: true }, "");
    expect(getTraceEvents()).toEqual([]);
  });

  it("records a traversal (popstate) against the previous URL", () => {
    window.history.pushState(null, "", "?item=abc");
    // Simulate Back: the browser moves the URL without going through our wrapper
    History.prototype.replaceState.call(window.history, null, "", "/dashboard");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(traceNames()).toEqual(["url:pushState", "url:popstate"]);
    expect(getTraceEvents().at(-1)?.data).toMatchObject({
      from: "/dashboard?item=abc",
      to: "/dashboard",
      removed: ["item"],
    });
  });

  it("ignores a popstate that didn't change the URL", () => {
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(getTraceEvents()).toEqual([]);
  });

  it("reports a traversal once, even when a router re-writes the URL before popstate", () => {
    window.history.pushState(null, "", "?item=abc");
    History.prototype.replaceState.call(window.history, null, "", "/dashboard");
    // e.g. Next syncing its state from the navigate event, before popstate
    window.history.replaceState({ router: true }, "", window.location.href);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(traceNames()).toEqual(["url:pushState", "url:popstate"]);
    expect(getTraceEvents().at(-1)?.data).toMatchObject({
      from: "/dashboard?item=abc",
      to: "/dashboard",
    });
  });

  it("restores the original history methods on uninstall", () => {
    const patched = window.history.pushState;
    uninstall();
    expect(window.history.pushState).not.toBe(patched);
    window.history.pushState(null, "", "?item=after");
    expect(getTraceEvents()).toEqual([]);
    uninstall = () => {};
  });
});
