import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/types/item";
import { DashboardItemDialog } from "./dashboard-item-dialog";

// Render a lightweight stand-in for the heavy detail dialog so the test focuses
// on DashboardItemDialog's resolve/mount-through-close behavior.
vi.mock("../item-card", () => ({
  ItemDetailDialogHost: ({
    item,
    open,
    onOpenChange,
    onExitComplete,
  }: {
    item: { id: string };
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onExitComplete?: () => void;
  }) => (
    <div data-testid="host" data-item={item.id} data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(false)}>
        close
      </button>
      <button type="button" onClick={() => onExitComplete?.()}>
        exit
      </button>
    </div>
  ),
}));

const closeItem = vi.fn();
let dialogState: { openItemId: string | null } = { openItemId: null };
vi.mock("../item-dialog-context", () => ({
  useItemDialog: () => ({ ...dialogState, closeItem }),
}));

vi.mock("@/lib/api-hooks", () => ({
  useUpdateCachedItemTitle: () => vi.fn(),
}));
vi.mock("@/lib/items/item-display-name", () => ({
  getItemDisplayName: (item: { title: string }) => item.title,
}));
vi.mock("@/lib/image-url", () => ({ getProxyImageUrl: () => "proxy" }));
vi.mock("@/lib/utils", () => ({
  formatBytes: () => "1 KB",
  getFileSizeFromMeta: () => BigInt(0),
}));

const items = [
  { id: "a", title: "A", kind: "image", fileKey: "fa", coverFileKey: null },
  { id: "b", title: "B", kind: "image", fileKey: "fb", coverFileKey: null },
] as unknown as Item[];

beforeEach(() => {
  closeItem.mockClear();
  dialogState = { openItemId: null };
});

describe("DashboardItemDialog", () => {
  it("renders nothing when no item is open", () => {
    render(<DashboardItemDialog items={items} />);
    expect(screen.queryByTestId("host")).not.toBeInTheDocument();
  });

  it("renders the open item's dialog, resolved by id from the list", () => {
    dialogState = { openItemId: "b" };
    render(<DashboardItemDialog items={items} />);
    const host = screen.getByTestId("host");
    expect(host).toHaveAttribute("data-item", "b");
    expect(host).toHaveAttribute("data-open", "true");
  });

  it("closes via the provider when the dialog requests it", () => {
    dialogState = { openItemId: "a" };
    render(<DashboardItemDialog items={items} />);
    fireEvent.click(screen.getByText("close"));
    expect(closeItem).toHaveBeenCalledOnce();
  });

  it("keeps the item mounted (open=false) after close, then clears on exit", () => {
    dialogState = { openItemId: "a" };
    const { rerender } = render(<DashboardItemDialog items={items} />);
    expect(screen.getByTestId("host")).toHaveAttribute("data-open", "true");

    // URL clears the open item — dialog should animate out, not vanish.
    dialogState = { openItemId: null };
    rerender(<DashboardItemDialog items={items} />);
    const host = screen.getByTestId("host");
    expect(host).toHaveAttribute("data-item", "a");
    expect(host).toHaveAttribute("data-open", "false");

    // Once the exit animation completes, it unmounts.
    fireEvent.click(screen.getByText("exit"));
    expect(screen.queryByTestId("host")).not.toBeInTheDocument();
  });
});
