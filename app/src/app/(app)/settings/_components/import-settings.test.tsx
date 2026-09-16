import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportSnapshot } from "@/lib/use-import-poll";

const post = vi.hoisted(() => vi.fn());
const useImportPoll = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  api: { post },
  ApiClientError: class ApiClientError extends Error {
    status: number;
    code?: string;
    constructor(error: { message: string; status: number; code?: string }) {
      super(error.message);
      this.status = error.status;
      this.code = error.code;
    }
  },
}));
vi.mock("@/lib/use-import-poll", () => ({ useImportPoll }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import { ApiClientError } from "@/lib/api-client";
import { ImportSettings } from "./import-settings";

const snapshot = (over: Partial<ImportSnapshot> = {}): ImportSnapshot => ({
  id: "imp1",
  source: "literal",
  status: "importing",
  totalCount: 5,
  importedCount: 0,
  skippedCount: 0,
  failedCount: 0,
  error: null,
  createdAt: "",
  completedAt: null,
  ...over,
});

describe("ImportSettings", () => {
  beforeEach(() => {
    post.mockReset();
    useImportPoll.mockReset().mockReturnValue(null);
    toastError.mockReset();
  });

  it("submits the entered credentials to the import route", async () => {
    post.mockResolvedValue({ importId: "imp1", total: 5 });
    render(<ImportSettings initialImport={null} />);

    fireEvent.change(screen.getByLabelText("Literal email"), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText("Literal password"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: /import my books/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/v1/imports/literal", {
        email: "a@b.c",
        password: "pw",
      }),
    );
  });

  it("surfaces a Literal error as a toast without setting an import", async () => {
    post.mockRejectedValue(
      new ApiClientError({ message: "Check your login details", status: 502 }),
    );
    render(<ImportSettings initialImport={null} />);

    fireEvent.change(screen.getByLabelText("Literal email"), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText("Literal password"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: /import my books/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Check your login details"),
    );
  });

  it("shows a completion summary from the poll", () => {
    useImportPoll.mockReturnValue(
      snapshot({ status: "completed", importedCount: 4, skippedCount: 1 }),
    );
    render(<ImportSettings initialImport={null} />);

    expect(screen.getByText("Import complete")).toBeInTheDocument();
    expect(
      screen.getByText("4 imported, 1 already in your library."),
    ).toBeInTheDocument();
  });

  it("disables the form while an import is in progress", () => {
    // The page seeds an active import (with its id), which is what drives the
    // in-progress/disabled state.
    const active = snapshot({ status: "importing" });
    useImportPoll.mockReturnValue(active);
    render(<ImportSettings initialImport={active} />);

    expect(
      screen.getByRole("button", { name: /import in progress/i }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Literal email")).toBeDisabled();
  });

  it("shows the failure reason when the import failed", () => {
    useImportPoll.mockReturnValue(
      snapshot({ status: "failed", error: "Import could not be completed" }),
    );
    render(<ImportSettings initialImport={null} />);

    expect(screen.getByText("Import failed")).toBeInTheDocument();
    expect(
      screen.getByText("Import could not be completed"),
    ).toBeInTheDocument();
  });
});
