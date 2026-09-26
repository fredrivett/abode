import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetTrace, traceNames } from "./test-utils";
import { getTraceEvents } from "./trace";
import { changedKeys, useDebugLifecycle } from "./use-debug-lifecycle";

function Probe({ value, flag }: { value: string | null; flag: boolean }) {
  useDebugLifecycle({
    name: "Probe",
    channel: "dialog",
    watch: { value, flag },
  });
  return null;
}

// Let the deferred (microtask) unmount log flush
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("changedKeys", () => {
  it("lists keys whose value changed, including added/removed keys", () => {
    expect(
      changedKeys({ a: 1, b: "x", c: true }, { a: 1, b: "y", d: 2 }),
    ).toEqual(["b", "c", "d"]);
  });
});

describe("useDebugLifecycle", () => {
  beforeEach(() => resetTrace());
  afterEach(() => resetTrace({ enabled: false }));

  it("records mount with the watched values, then unmount", async () => {
    const { unmount } = render(<Probe value="a" flag />);
    expect(getTraceEvents()[0]).toMatchObject({
      event: "Probe:mount",
      data: { value: "a", flag: true },
    });
    unmount();
    await flush();
    expect(traceNames()).toEqual([
      "dialog:Probe:mount",
      "dialog:Probe:unmount",
    ]);
  });

  it("records which watched values changed", () => {
    const { rerender } = render(<Probe value="a" flag />);
    rerender(<Probe value="a" flag />);
    rerender(<Probe value={null} flag />);
    expect(traceNames()).toEqual(["dialog:Probe:mount", "dialog:Probe:change"]);
    expect(getTraceEvents()[1].data).toEqual({ value: "a → null" });
  });

  it("ignores Strict Mode's simulated unmount/remount", async () => {
    render(
      <StrictMode>
        <Probe value="a" flag />
      </StrictMode>,
    );
    await flush();
    expect(traceNames()).toEqual(["dialog:Probe:mount"]);
  });

  it("still records a real remount (new instance)", async () => {
    const { rerender } = render(<Probe key="1" value="a" flag />);
    rerender(<Probe key="2" value="a" flag />);
    await flush();
    expect(traceNames()).toEqual([
      "dialog:Probe:mount",
      "dialog:Probe:unmount",
      "dialog:Probe:mount",
    ]);
  });
});
