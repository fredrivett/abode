import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataExportSnapshot } from "@/lib/export/snapshot";

const post = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const capture = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  api: { post, get },
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(error: { message: string; status: number }) {
      super(error.message);
      this.status = error.status;
    }
  },
}));
vi.mock("posthog-js", () => ({ default: { capture } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import { ApiClientError } from "@/lib/api-client";
import { ExportSettings } from "./export-settings";

const HOUR = 60 * 60 * 1000;

const snapshot = (
  over: Partial<DataExportSnapshot> = {},
): DataExportSnapshot => ({
  id: "exp1",
  status: "completed",
  itemCount: 12,
  sizeBytes: 2048,
  error: null,
  createdAt: new Date(Date.now() - HOUR).toISOString(),
  completedAt: new Date(Date.now() - HOUR).toISOString(),
  expiresAt: new Date(Date.now() + 6 * 24 * HOUR).toISOString(),
  ...over,
});

describe("ExportSettings", () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    toastError.mockReset();
    capture.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests an export and shows it as in progress", async () => {
    post.mockResolvedValue({
      export: snapshot({ status: "pending", itemCount: null, sizeBytes: null }),
    });
    render(<ExportSettings initialExports={[]} available />);

    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/v1/exports"));
    expect(capture).toHaveBeenCalledWith("data_export_submitted");
    expect(
      await screen.findByRole("button", { name: /export in progress/i }),
    ).toBeDisabled();
    expect(screen.getByText(/preparing your export/i)).toBeInTheDocument();
  });

  it("surfaces a refused request (e.g. the daily cap) as a toast", async () => {
    post.mockRejectedValue(
      new ApiClientError({ message: "Try again tomorrow.", status: 429 }),
    );
    render(<ExportSettings initialExports={[]} available />);

    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Try again tomorrow."),
    );
  });

  it("offers a download for a ready export, with its size and item count", () => {
    render(<ExportSettings initialExports={[snapshot()]} available />);

    expect(screen.getByText("Ready to download")).toBeInTheDocument();
    expect(screen.getByText(/12 items/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download/i })).toHaveAttribute(
      "href",
      "/api/v1/exports/exp1/download",
    );

    fireEvent.click(screen.getByRole("link", { name: /download/i }));
    expect(capture).toHaveBeenCalledWith("data_export_download_clicked");
  });

  it("treats a completed export past its expiry as expired, with no download", () => {
    render(
      <ExportSettings
        initialExports={[
          snapshot({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
        ]}
        available
      />,
    );

    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download/i })).toBeNull();
  });

  it("shows why an export failed", () => {
    render(
      <ExportSettings
        initialExports={[
          snapshot({
            status: "failed",
            error: "The export couldn't be completed.",
          }),
        ]}
        available
      />,
    );

    expect(screen.getByText("Export failed")).toBeInTheDocument();
    expect(
      screen.getByText("The export couldn't be completed."),
    ).toBeInTheDocument();
  });

  it("polls an in-progress export until it's ready", async () => {
    vi.useFakeTimers();
    get.mockResolvedValue({ exports: [snapshot()] });
    render(
      <ExportSettings
        initialExports={[snapshot({ status: "exporting" })]}
        available
      />,
    );
    expect(
      screen.getByRole("button", { name: /export in progress/i }),
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(get).toHaveBeenCalledWith("/api/v1/exports");
    expect(screen.getByText("Ready to download")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export my data" }),
    ).toBeEnabled();
  });

  it("explains when exporting isn't available on the deployment", () => {
    render(<ExportSettings initialExports={[]} available={false} />);

    expect(screen.queryByRole("button", { name: "Export my data" })).toBeNull();
    expect(
      screen.getByText(/isn't available on this deployment/i),
    ).toBeInTheDocument();
  });
});
