import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTrace } from "@/lib/debug/test-utils";
import { getTraceEvents } from "@/lib/debug/trace";
import type { Item } from "@/lib/types/item";
import { CentralItemDialog } from "./central-item-dialog";

// AnimatePresence just renders its children in these tests (the real
// exit-keeping is framer's job, not our logic).
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Lightweight stand-ins for the persistent frame and the (heavy) detail body so
// the test focuses on CentralItemDialog's resolve + body-swap behavior.
vi.mock("../item-card", () => ({
  ItemDialogFrame: ({
    open,
    animateEntrance,
    onOpenChange,
    children,
  }: {
    open: boolean;
    animateEntrance?: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) => (
    <div
      data-testid="frame"
      data-open={String(open)}
      data-animate={String(animateEntrance)}
    >
      <button type="button" onClick={() => onOpenChange(false)}>
        close
      </button>
      {children}
    </div>
  ),
  ItemDetailBody: ({
    item,
    animateEntrance,
  }: {
    item: { id: string };
    animateEntrance?: boolean;
  }) => (
    <div
      data-testid="body"
      data-item={item.id}
      data-animate={String(animateEntrance)}
    />
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
  // Respect `enabled` so a gated-off fetch (e.g. a non-owner) returns nothing.
  useItem: (_id: string | null, enabled: boolean) =>
    enabled ? useItemReturn : { data: undefined },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("./item-dialog-skeleton", () => ({
  ItemDialogSkeletonBody: ({ seed }: { seed: { id: string } }) => (
    <div data-testid="skeleton" data-item={seed.id} />
  ),
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

function renderDialog(props?: { canEdit?: boolean; initialItem?: Item }) {
  return render(
    <CentralItemDialog
      onItemRenamed={() => {}}
      canEdit={props?.canEdit ?? true}
      items={items}
      initialItem={props?.initialItem}
    />,
  );
}

beforeEach(() => {
  closeItem.mockClear();
  dialogState = { openItemId: null, openItemSeed: null };
  useItemReturn = { data: undefined };
});

describe("CentralItemDialog", () => {
  it("renders nothing when no item is open", () => {
    renderDialog();
    expect(screen.queryByTestId("frame")).not.toBeInTheDocument();
  });

  it("renders the open item's body, resolved by id from the list", () => {
    dialogState = { openItemId: "b" };
    renderDialog();
    expect(screen.getByTestId("frame")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("body")).toHaveAttribute("data-item", "b");
  });

  it("closes via the provider when the frame requests it", () => {
    dialogState = { openItemId: "a" };
    renderDialog();
    fireEvent.click(screen.getByText("close"));
    expect(closeItem).toHaveBeenCalledOnce();
  });

  it("animates the entrance on a fresh open but not on an in-place swap", () => {
    const { rerender } = renderDialog();
    // Fresh open (was closed) → animate in.
    dialogState = { openItemId: "a" };
    rerender(
      <CentralItemDialog onItemRenamed={() => {}} canEdit items={items} />,
    );
    expect(screen.getByTestId("body")).toHaveAttribute("data-animate", "true");
    const frame = screen.getByTestId("frame");

    // Swap straight to another open item → instant, still open, no skeleton.
    dialogState = { openItemId: "b" };
    rerender(
      <CentralItemDialog onItemRenamed={() => {}} canEdit items={items} />,
    );
    const body = screen.getByTestId("body");
    expect(body).toHaveAttribute("data-item", "b");
    expect(body).toHaveAttribute("data-animate", "false");
    // The frame is the same element — it must not remount (that's what flashed).
    expect(screen.getByTestId("frame")).toBe(frame);
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("keeps an off-grid swap instant across its loading gap", () => {
    dialogState = { openItemId: "a" };
    const { rerender } = renderDialog();
    const frame = screen.getByTestId("frame");

    // Swap to an off-grid item — its fetch hasn't resolved, so the skeleton
    // shows and resolved is briefly null.
    dialogState = {
      openItemId: "z",
      openItemSeed: { id: "z", imageFileKey: "fz" },
    };
    rerender(
      <CentralItemDialog onItemRenamed={() => {}} canEdit items={items} />,
    );
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    // Same frame across item → skeleton → item; only the body swaps.
    expect(screen.getByTestId("frame")).toBe(frame);

    // Fetch resolves — the replacement must appear instantly (this was a swap,
    // not a fresh open), inside the same still-mounted frame.
    useItemReturn = {
      data: {
        id: "z",
        title: "Z",
        kind: "image",
        fileKey: "fz",
        coverFileKey: null,
      } as unknown as Item,
    };
    rerender(
      <CentralItemDialog onItemRenamed={() => {}} canEdit items={items} />,
    );
    const body = screen.getByTestId("body");
    expect(body).toHaveAttribute("data-item", "z");
    expect(body).toHaveAttribute("data-animate", "false");
    expect(screen.getByTestId("frame")).toBe(frame);
  });

  it("does not fetch (or mount a blank dialog) for a non-owner off-grid open", () => {
    // Open id isn't in the list; a fetch would resolve it, but a non-owner
    // can't hit the owner-scoped endpoint. With no seed either, there's nothing
    // to show — so no frame at all, rather than a blank title-less dialog.
    dialogState = { openItemId: "z" };
    useItemReturn = {
      data: { id: "z", title: "Z", kind: "image" } as unknown as Item,
    };
    renderDialog({ canEdit: false });
    expect(screen.queryByTestId("frame")).not.toBeInTheDocument();
    expect(closeItem).not.toHaveBeenCalled();
  });

  it("shows the seed skeleton while an off-grid item is still loading", () => {
    dialogState = {
      openItemId: "z",
      openItemSeed: { id: "z", imageFileKey: "fz" },
    };
    renderDialog();
    expect(screen.getByTestId("skeleton")).toHaveAttribute("data-item", "z");
    expect(screen.queryByTestId("body")).not.toBeInTheDocument();
  });

  it("swaps the skeleton for the real body once the fetch resolves", () => {
    dialogState = {
      openItemId: "z",
      openItemSeed: { id: "z", imageFileKey: "fz" },
    };
    const { rerender } = renderDialog();
    expect(screen.getByTestId("skeleton")).toHaveAttribute("data-item", "z");
    expect(screen.queryByTestId("body")).not.toBeInTheDocument();

    useItemReturn = {
      data: {
        id: "z",
        title: "Z",
        kind: "image",
        fileKey: "fz",
        coverFileKey: null,
      } as unknown as Item,
    };
    rerender(
      <CentralItemDialog onItemRenamed={() => {}} canEdit items={items} />,
    );
    expect(screen.getByTestId("body")).toHaveAttribute("data-item", "z");
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("closes the dialog when the off-grid fetch errors", () => {
    dialogState = {
      openItemId: "z",
      openItemSeed: { id: "z", imageFileKey: "fz" },
    };
    useItemReturn = { data: undefined, isError: true };
    renderDialog();
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
    renderDialog({ initialItem });
    expect(screen.getByTestId("body")).toHaveAttribute("data-item", "z");
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("removes the dialog once the open item clears", () => {
    dialogState = { openItemId: "a" };
    const { rerender } = renderDialog();
    expect(screen.getByTestId("frame")).toBeInTheDocument();

    dialogState = { openItemId: null };
    rerender(
      <CentralItemDialog onItemRenamed={() => {}} canEdit items={items} />,
    );
    expect(screen.queryByTestId("frame")).not.toBeInTheDocument();
  });
});

describe("CentralItemDialog debug trace", () => {
  beforeEach(() => resetTrace());
  afterEach(() => resetTrace({ enabled: false }));

  it("records the resolution source flipping when the open item leaves the list", () => {
    dialogState = { openItemId: "a" };
    const { rerender } = renderDialog();
    // e.g. a refetch/search swap drops the open item from the loaded list
    rerender(
      <CentralItemDialog
        onItemRenamed={() => {}}
        canEdit
        items={items.filter((item) => item.id !== "a")}
      />,
    );
    const change = getTraceEvents().find(
      (event) => event.event === "CentralItemDialog:change",
    );
    expect(change?.data).toMatchObject({
      source: "list → none",
      hasContent: "true → false",
      needsFetch: "false → true",
    });
  });
});
