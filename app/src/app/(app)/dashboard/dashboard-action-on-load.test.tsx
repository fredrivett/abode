import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MILESTONE_CONFIG } from "@/lib/milestones";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSearchFocusStore } from "@/stores/search-focus-store";
import {
  DashboardActionOnLoad,
  isDashboardAction,
} from "./dashboard-action-on-load";

// Search params follow the real (jsdom) URL, so stripping the param shows up
// on the next render as it does in the app
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/lib/db", () => ({ default: {} }));

const withCamera = () =>
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });

const visit = (url: string) => window.history.pushState(null, "", url);

beforeEach(() => {
  useCommandPaletteStore.setState({
    scannerOpen: false,
    uploadDialogOpen: false,
  });
  useSearchFocusStore.setState({ filterPromptRequested: false });
  vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  visit("/");
});

const expectParamStripped = () =>
  expect(window.history.replaceState).toHaveBeenCalledWith(
    null,
    "",
    "/dashboard",
  );

describe("DashboardActionOnLoad", () => {
  it("opens the scanner for ?action=scan and strips the param", () => {
    withCamera();
    visit("/dashboard?action=scan");
    render(<DashboardActionOnLoad />);
    expect(useCommandPaletteStore.getState().scannerOpen).toBe(true);
    expectParamStripped();
  });

  it("doesn't open the scanner without a camera API", () => {
    vi.stubGlobal("navigator", {});
    visit("/dashboard?action=scan");
    render(<DashboardActionOnLoad />);
    expect(useCommandPaletteStore.getState().scannerOpen).toBe(false);
  });

  it("opens the upload dialog for ?action=upload and strips the param", () => {
    visit("/dashboard?action=upload");
    render(<DashboardActionOnLoad />);
    expect(useCommandPaletteStore.getState().uploadDialogOpen).toBe(true);
    expect(useCommandPaletteStore.getState().scannerOpen).toBe(false);
    expectParamStripped();
  });

  it("asks the search to open its filter list for ?action=search", () => {
    visit("/dashboard?action=search");
    render(<DashboardActionOnLoad />);
    expect(useSearchFocusStore.getState().filterPromptRequested).toBe(true);
    expect(useCommandPaletteStore.getState().uploadDialogOpen).toBe(false);
    expectParamStripped();
  });

  it("keeps other query params when stripping the action", () => {
    visit("/dashboard?action=upload&item=abc#x");
    render(<DashboardActionOnLoad />);
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/dashboard?item=abc#x",
    );
  });

  it("does nothing for unknown or missing actions", () => {
    withCamera();
    visit("/dashboard?action=nope");
    render(<DashboardActionOnLoad />);
    visit("/dashboard");
    render(<DashboardActionOnLoad />);
    const { scannerOpen, uploadDialogOpen } = useCommandPaletteStore.getState();
    expect(scannerOpen).toBe(false);
    expect(uploadDialogOpen).toBe(false);
    expect(useSearchFocusStore.getState().filterPromptRequested).toBe(false);
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("doesn't repeat once the param is stripped", () => {
    visit("/dashboard?action=upload");
    const { rerender } = render(<DashboardActionOnLoad />);
    useCommandPaletteStore.setState({ uploadDialogOpen: false });
    rerender(<DashboardActionOnLoad />);
    expect(useCommandPaletteStore.getState().uploadDialogOpen).toBe(false);
  });

  // Following a second checklist link while already on the dashboard
  it("runs a later action reached by soft navigation", () => {
    visit("/dashboard?action=search");
    const { rerender } = render(<DashboardActionOnLoad />);
    visit("/dashboard?action=upload");
    rerender(<DashboardActionOnLoad />);
    expect(useCommandPaletteStore.getState().uploadDialogOpen).toBe(true);
  });

  // Checklist links once pointed at params nothing read, landing on a plain
  // dashboard
  it.each(
    Object.entries(MILESTONE_CONFIG).filter(([, { destination }]) =>
      destination.startsWith("/dashboard?"),
    ),
  )("handles the %s checklist deep link", (_type, { destination }) => {
    const params = new URL(destination, "http://localhost").searchParams;
    expect([...params.keys()]).toEqual(["action"]);
    expect(isDashboardAction(params.get("action"))).toBe(true);
  });
});
