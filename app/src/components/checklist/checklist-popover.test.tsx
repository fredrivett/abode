import type { MilestoneType } from "@prisma/client";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type MilestoneConfig,
  useMilestoneStore,
} from "@/stores/milestone-store";
import { ChecklistPopover } from "./checklist-popover";

const config: Partial<Record<MilestoneType, MilestoneConfig>> = {
  upload_first_image: {
    label: "Upload your first image",
    destination: "/dashboard?action=upload",
  },
  scan_first_document: {
    label: "Scan your first document",
    destination: "/dashboard?action=scan",
  },
  create_first_room: {
    label: "Create your first room",
    destination: "/rooms/new",
  },
};

type Status = {
  completed?: Array<{ type: MilestoneType; completedAt: string }>;
  pending: MilestoneType[];
};

const fetchMock = vi.fn();
const respondWith = ({ completed = [], pending }: Status) =>
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ completed, pending, hasArticle: false, config }),
    ),
  );

const withCamera = () =>
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });

beforeEach(() => {
  useMilestoneStore.setState({
    completed: [],
    pending: [],
    hasArticle: false,
    isLoaded: false,
    config: null,
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const renderPopover = async () => {
  render(<ChecklistPopover />);
  // The initial load for the remaining-tasks badge
  await act(async () => {});
};

const open = async () => {
  fireEvent.click(screen.getByRole("button", { name: /checklist/i }));
  await act(async () => {});
};

const link = (name: string) => screen.getByRole("link", { name });

describe("ChecklistPopover", () => {
  it("re-fetches each time it opens, revealing newly unlocked tasks", async () => {
    respondWith({ pending: ["upload_first_image"] });
    await renderPopover();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    respondWith({
      completed: [
        { type: "upload_first_image", completedAt: new Date().toISOString() },
      ],
      pending: ["create_first_room"],
    });
    await open();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(link("Create your first room")).toBeInTheDocument();
    expect(link("Upload your first image")).toBeInTheDocument();
  });

  it("keeps the last known list up when a re-fetch fails", async () => {
    respondWith({ pending: ["upload_first_image"] });
    await renderPopover();

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await open();

    expect(link("Upload your first image")).toBeInTheDocument();
  });

  it("keeps a task ticked off locally when a re-fetch predates its write", async () => {
    respondWith({ pending: ["upload_first_image", "create_first_room"] });
    await renderPopover();
    act(() => useMilestoneStore.getState().markComplete("upload_first_image"));

    respondWith({ pending: ["upload_first_image", "create_first_room"] });
    await open();

    const { completed, pending } = useMilestoneStore.getState();
    expect(completed.map((m) => m.type)).toEqual(["upload_first_image"]);
    expect(pending).toEqual(["create_first_room"]);
  });

  it("links the scan task to the scanner where there's a camera", async () => {
    withCamera();
    respondWith({ pending: ["scan_first_document"] });
    await renderPopover();
    respondWith({ pending: ["scan_first_document"] });
    await open();

    expect(link("Scan your first document")).toHaveAttribute(
      "href",
      "/dashboard?action=scan",
    );
  });

  it("links the scan task to the scanning help without a camera", async () => {
    vi.stubGlobal("navigator", {});
    respondWith({ pending: ["scan_first_document"] });
    await renderPopover();
    respondWith({ pending: ["scan_first_document"] });
    await open();

    expect(link("Scan your first document")).toHaveAttribute(
      "href",
      "/help/scanning",
    );
  });
});
