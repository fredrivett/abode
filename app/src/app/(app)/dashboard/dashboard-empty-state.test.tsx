import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import {
  DashboardEmptyState,
  DashboardEmptyStateView,
} from "./dashboard-empty-state";

const { capture, handleFileUpload, uploadState } = vi.hoisted(() => ({
  capture: vi.fn(),
  handleFileUpload: vi.fn(),
  uploadState: { isFileLoading: false },
}));

vi.mock("posthog-js", () => ({ default: { capture } }));
vi.mock("@/hooks/use-upload", () => ({
  useUpload: () => ({ handleFileUpload, ...uploadState }),
}));

const fileInput = () =>
  screen.getByTestId<HTMLInputElement>("empty-state-file-input");

const pdf = () =>
  new File(["%PDF-1.7"], "lease.pdf", { type: "application/pdf" });

beforeEach(() => {
  capture.mockReset();
  handleFileUpload.mockReset();
  uploadState.isFileLoading = false;
  useCommandPaletteStore.setState({
    uploadDialogOpen: false,
    uploadDialogFocusUrl: false,
  });
});

describe("DashboardEmptyState", () => {
  it("offers both ways to add a first item", () => {
    render(<DashboardEmptyState />);
    expect(
      screen.getByRole("heading", { name: "Welcome home" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload a photo or PDF" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Paste a link" })).toBeEnabled();
    expect(screen.getByText(/links, photos and PDFs/)).toBeInTheDocument();
  });

  it("picks files with the same types as the upload dialog", () => {
    render(<DashboardEmptyState />);
    expect(fileInput()).toHaveAttribute("type", "file");
    expect(fileInput()).toHaveAttribute("accept", UPLOAD_ACCEPT);
  });

  it("opens the native picker from the upload button", () => {
    render(<DashboardEmptyState />);
    const click = vi.spyOn(fileInput(), "click");
    fireEvent.click(
      screen.getByRole("button", { name: "Upload a photo or PDF" }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith("empty_state_action_clicked", {
      action: "upload",
    });
  });

  it("uploads the picked file and tracks it once saved", async () => {
    handleFileUpload.mockResolvedValue(true);
    render(<DashboardEmptyState />);
    const file = pdf();
    fireEvent.change(fileInput(), { target: { files: [file] } });

    expect(handleFileUpload).toHaveBeenCalledWith(file, {
      source: "empty_state_picker",
    });
    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith("item_uploaded", {
        file_type: "application/pdf",
        file_size: file.size,
        source: "empty_state_picker",
      }),
    );
  });

  it("doesn't track a failed upload", async () => {
    handleFileUpload.mockResolvedValue(false);
    render(<DashboardEmptyState />);
    fireEvent.change(fileInput(), { target: { files: [pdf()] } });

    await waitFor(() => expect(handleFileUpload).toHaveBeenCalled());
    expect(capture).not.toHaveBeenCalledWith(
      "item_uploaded",
      expect.anything(),
    );
  });

  it("opens the Add item dialog focused on the URL field for 'Paste a link'", () => {
    render(<DashboardEmptyState />);
    fireEvent.click(screen.getByRole("button", { name: "Paste a link" }));

    expect(useCommandPaletteStore.getState()).toMatchObject({
      uploadDialogOpen: true,
      uploadDialogFocusUrl: true,
    });
    expect(capture).toHaveBeenCalledWith("empty_state_action_clicked", {
      action: "paste_link",
    });
  });

  it("shows upload progress and blocks both actions while uploading", () => {
    uploadState.isFileLoading = true;
    render(<DashboardEmptyState />);
    expect(screen.getByText("Uploading")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});

describe("DashboardEmptyStateView", () => {
  it("ignores a change event with no file (picker cancelled)", () => {
    const onFileSelected = vi.fn();
    render(
      <DashboardEmptyStateView
        isUploading={false}
        onFileSelected={onFileSelected}
        onPasteLink={vi.fn()}
      />,
    );
    fireEvent.change(fileInput(), { target: { files: [] } });
    expect(onFileSelected).not.toHaveBeenCalled();
  });
});
