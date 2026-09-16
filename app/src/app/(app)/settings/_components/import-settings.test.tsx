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
    useImportPoll.mockReset().mockReturnValue({ status: null, error: false });
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
    useImportPoll.mockReturnValue({
      status: snapshot({
        status: "completed",
        importedCount: 4,
        skippedCount: 1,
      }),
      error: false,
    });
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
    useImportPoll.mockReturnValue({ status: active, error: false });
    render(<ImportSettings initialImport={active} />);

    expect(
      screen.getByRole("button", { name: /import in progress/i }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Literal email")).toBeDisabled();
  });

  it("shows the failure reason when the import failed", () => {
    useImportPoll.mockReturnValue({
      status: snapshot({
        status: "failed",
        error: "Import could not be completed",
      }),
      error: false,
    });
    render(<ImportSettings initialImport={null} />);

    expect(screen.getByText("Import failed")).toBeInTheDocument();
    expect(
      screen.getByText("Import could not be completed"),
    ).toBeInTheDocument();
  });

  it("re-enables the form (with a note) when polling can't confirm status", () => {
    // Repeated poll failures on an active import must not lock the form forever.
    const active = snapshot({ status: "importing" });
    useImportPoll.mockReturnValue({ status: active, error: true });
    render(<ImportSettings initialImport={active} />);

    // Fields are re-enabled (not locked by an unconfirmable in-progress state)...
    const emailInput = screen.getByLabelText("Literal email");
    expect(emailInput).not.toBeDisabled();
    expect(
      screen.getByText(/couldn't check the import's status/i),
    ).toBeInTheDocument();

    // ...and once filled, the user can retry (button only gated by field content).
    fireEvent.change(emailInput, { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText("Literal password"), {
      target: { value: "pw" },
    });
    expect(
      screen.getByRole("button", { name: /import my books/i }),
    ).not.toBeDisabled();
  });
});
