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

type Seed = { id: string; imageFileKey: string | null } | null;
const closeItem = vi.fn();
let dialogState: { openItemId: string | null; openItemSeed?: Seed } = {
  openItemId: null,
  openItemSeed: null,
};
vi.mock("../item-dialog-context", () => ({
  useItemDialog: () => ({ ...dialogState, closeItem }),
}));

let useItemReturn: { data: Item | undefined; isError?: boolean } = {
  data: undefined,
};
vi.mock("@/lib/items/use-item", () => ({
  useItem: () => useItemReturn,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("./item-dialog-skeleton", () => ({
  ItemDialogSkeleton: ({ seed }: { seed: { id: string } }) => (
    <div data-testid="skeleton" data-item={seed.id} />
  ),
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
  dialogState = { openItemId: null, openItemSeed: null };
  useItemReturn = { data: undefined };
});

describe("DashboardItemDialog", () => {
  it("renders nothing when no item is open", () => {
    render(<DashboardItemDialog onItemRenamed={() => {}} items={items} />);
    expect(screen.queryByTestId("host")).not.toBeInTheDocument();
  });

  it("renders the open item's dialog, resolved by id from the list", () => {
    dialogState = { openItemId: "b" };
    render(<DashboardItemDialog onItemRenamed={() => {}} items={items} />);
    const host = screen.getByTestId("host");
    expect(host).toHaveAttribute("data-item", "b");
    expect(host).toHaveAttribute("data-open", "true");
  });

  it("closes via the provider when the dialog requests it", () => {
    dialogState = { openItemId: "a" };
    render(<DashboardItemDialog onItemRenamed={() => {}} items={items} />);
    fireEvent.click(screen.getByText("close"));
    expect(closeItem).toHaveBeenCalledOnce();
  });

  it("shows the seed skeleton while an off-grid item is still loading", () => {
    // Open id isn't in the list and no fetched data yet.
    dialogState = {
      openItemId: "z",
      openItemSeed: { id: "z", imageFileKey: "fz" },
    };
    render(<DashboardItemDialog onItemRenamed={() => {}} items={items} />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute("data-item", "z");
    expect(screen.queryByTestId("host")).not.toBeInTheDocument();
  });

  it("swaps the skeleton for the real dialog once the fetch resolves", () => {
    dialogState = {
      openItemId: "z",
      openItemSeed: { id: "z", imageFileKey: "fz" },
    };
    // First render: off-grid item, fetch not resolved → skeleton.
    const { rerender } = render(
      <DashboardItemDialog onItemRenamed={() => {}} items={items} />,
    );
    expect(screen.getByTestId("skeleton")).toHaveAttribute("data-item", "z");
    expect(screen.queryByTestId("host")).not.toBeInTheDocument();

    // Fetch resolves → the real dialog replaces the skeleton.
    useItemReturn = {
      data: {
        id: "z",
        title: "Z",
        kind: "image",
        fileKey: "fz",
        coverFileKey: null,
      } as unknown as Item,
    };
    rerender(<DashboardItemDialog onItemRenamed={() => {}} items={items} />);
    expect(screen.getByTestId("host")).toHaveAttribute("data-item", "z");
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("closes the dialog when the off-grid fetch errors", () => {
    dialogState = {
      openItemId: "z",
      openItemSeed: { id: "z", imageFileKey: "fz" },
    };
    useItemReturn = { data: undefined, isError: true };
    render(<DashboardItemDialog onItemRenamed={() => {}} items={items} />);
    expect(closeItem).toHaveBeenCalled();
  });

  it("renders the deep-link initialItem without a skeleton", () => {
    dialogState = { openItemId: "z", openItemSeed: null };
    const initialItem = {
      id: "z",
      title: "Z",
      kind: "image",
      fileKey: "fz",
      coverFileKey: null,
    } as unknown as Item;
    render(
      <DashboardItemDialog
        onItemRenamed={() => {}}
        items={items}
        initialItem={initialItem}
      />,
    );
    expect(screen.getByTestId("host")).toHaveAttribute("data-item", "z");
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("keeps the item mounted (open=false) after close, then clears on exit", () => {
    dialogState = { openItemId: "a" };
    const { rerender } = render(
      <DashboardItemDialog onItemRenamed={() => {}} items={items} />,
    );
    expect(screen.getByTestId("host")).toHaveAttribute("data-open", "true");

    // URL clears the open item — dialog should animate out, not vanish.
    dialogState = { openItemId: null };
    rerender(<DashboardItemDialog onItemRenamed={() => {}} items={items} />);
    const host = screen.getByTestId("host");
    expect(host).toHaveAttribute("data-item", "a");
    expect(host).toHaveAttribute("data-open", "false");

    // Once the exit animation completes, it unmounts.
    fireEvent.click(screen.getByText("exit"));
    expect(screen.queryByTestId("host")).not.toBeInTheDocument();
  });
});
