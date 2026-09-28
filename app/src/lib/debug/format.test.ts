import { describe, expect, it } from "vitest";
import {
  buildTraceExport,
  formatTraceGap,
  formatTraceSummary,
  formatTraceTime,
} from "./format";

describe("formatTraceSummary", () => {
  it("renders key=value pairs, omitting the stack", () => {
    expect(
      formatTraceSummary({
        to: "/dashboard",
        removed: ["item"],
        stack: ["at x"],
        nested: { a: 1 },
        none: null,
      }),
    ).toBe('to=/dashboard removed=[item] nested={"a":1} none=null');
  });

  it("truncates long summaries", () => {
    const summary = formatTraceSummary({ long: "x".repeat(300) }, 20);
    expect(summary).toHaveLength(20);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("is empty without data", () => {
    expect(formatTraceSummary(undefined)).toBe("");
  });
});

describe("formatTraceTime / formatTraceGap", () => {
  it("formats times and gaps", () => {
    expect(formatTraceTime(12345.6)).toBe("12.346s");
    expect(formatTraceGap(null)).toBe("");
    expect(formatTraceGap(12.4)).toBe("+12ms");
    expect(formatTraceGap(2500)).toBe("+2.5s");
  });
});

describe("buildTraceExport", () => {
  it("wraps events with page context", () => {
    window.history.replaceState(null, "", "/dashboard?item=abc");
    const events = [{ id: 1, t: 1, channel: "mark" as const, event: "mark" }];
    const exported = buildTraceExport(events);
    expect(exported).toMatchObject({
      url: "/dashboard?item=abc",
      events,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    expect(() => new Date(exported.capturedAt).toISOString()).not.toThrow();
  });
});
