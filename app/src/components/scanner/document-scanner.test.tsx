import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentScanner } from "./document-scanner";

const workers = vi.hoisted(() => ({
  created: [] as { init: () => Promise<string>; terminate: () => void }[],
  initResults: [] as ("ml" | Error)[],
}));

vi.mock("posthog-js", () => ({ default: { captureException: vi.fn() } }));

vi.mock("@/lib/scanner/scanner-client", () => ({
  ScannerClient: {
    create: () => {
      const result = workers.initResults.shift() ?? "ml";
      const client = {
        init: () =>
          result instanceof Error
            ? Promise.reject(result)
            : Promise.resolve(result),
        terminate: vi.fn(),
      };
      workers.created.push(client);
      return client;
    },
  },
}));

describe("DocumentScanner", () => {
  beforeEach(() => {
    workers.created = [];
    workers.initResults = [];
    // jsdom has no layout engine; the camera view measures itself
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderScanner() {
    const onOpenChange = vi.fn();
    render(
      <DocumentScanner
        open
        onOpenChange={onOpenChange}
        onSave={vi.fn(async () => true)}
      />,
    );
    return { onOpenChange };
  }

  it("retries a failed load with a fresh worker", async () => {
    workers.initResults = [new Error("Failed to fetch scanic.js")];
    renderScanner();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't open the scanner",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(workers.created).toHaveLength(2);
    expect(workers.created[0]?.terminate).toHaveBeenCalled();
  });

  it("closes from a failed load", async () => {
    workers.initResults = [new Error("Failed to fetch scanic.js")];
    const { onOpenChange } = renderScanner();

    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows no error when the scanner loads", async () => {
    renderScanner();
    expect(
      await screen.findByRole("button", { name: "Close scanner" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
