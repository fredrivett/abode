import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TraceEvent } from "@/lib/debug/trace";
import { DebugPanel, type DebugPanelProps } from "./debug-panel";

const EVENTS: TraceEvent[] = [
  {
    id: 1,
    t: 1000,
    channel: "url",
    event: "replaceState",
    data: {
      to: "/dashboard?q=cats",
      removed: ["item"],
      stack: ["at writeUrl"],
    },
  },
  { id: 2, t: 1010, channel: "dialog", event: "CentralItemDialog:change" },
  { id: 3, t: 2500, channel: "grid", event: "reflow", data: { moved: 4 } },
];

function renderPanel(props: Partial<DebugPanelProps> = {}) {
  const handlers = {
    onTogglePause: vi.fn(),
    onClear: vi.fn(),
    onCopy: vi.fn(),
    onMark: vi.fn(),
    onDisable: vi.fn(),
  };
  render(
    <DebugPanel events={EVENTS} paused={false} {...handlers} {...props} />,
  );
  return handlers;
}

describe("DebugPanel", () => {
  it("lists events with their summary and gap from the previous one", () => {
    renderPanel();
    const log = screen.getByRole("log");
    expect(within(log).getByText("replaceState")).toBeInTheDocument();
    expect(
      within(log).getByText("to=/dashboard?q=cats removed=[item]"),
    ).toBeInTheDocument();
    expect(within(log).getByText("+10ms")).toBeInTheDocument();
    expect(within(log).getByText("+1.5s")).toBeInTheDocument();
  });

  it("hides a channel when its filter is toggled off", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "grid 1" }));
    expect(screen.getByRole("button", { name: "grid 1" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      within(screen.getByRole("log")).queryByText("reflow"),
    ).not.toBeInTheDocument();
  });

  it("expands a row to show its full data, including the stack", () => {
    renderPanel();
    fireEvent.click(screen.getByText("replaceState"));
    expect(screen.getByText(/"at writeUrl"/)).toBeInTheDocument();
  });

  it("wires the toolbar actions", () => {
    const handlers = renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: "Mark (drop a marker)" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy trace as JSON" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Turn debug tools off" }),
    );
    expect(handlers.onMark).toHaveBeenCalledOnce();
    expect(handlers.onTogglePause).toHaveBeenCalledOnce();
    expect(handlers.onClear).toHaveBeenCalledOnce();
    expect(handlers.onCopy).toHaveBeenCalledOnce();
    expect(handlers.onDisable).toHaveBeenCalledOnce();
  });

  it("shows Resume and an empty state while paused", () => {
    renderPanel({ paused: true, events: [] });
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByText("Paused.")).toBeInTheDocument();
  });

  it("minimises to a pill and expands again", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Minimise" }));
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tracing/ }));
    expect(screen.getByRole("log")).toBeInTheDocument();
  });

  it("keeps pointer/focus events from reaching document listeners (e.g. a modal's outside-click dismiss)", () => {
    renderPanel();
    const onDocumentPointerDown = vi.fn();
    document.addEventListener("pointerdown", onDocumentPointerDown);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Clear" }));
    document.removeEventListener("pointerdown", onDocumentPointerDown);
    expect(onDocumentPointerDown).not.toHaveBeenCalled();
  });
});
