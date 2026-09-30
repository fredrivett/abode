import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TokenSavedItem } from "@/lib/personal-access-tokens";
import { TokenSavedItemsDialog } from "./token-saved-items-dialog";

const TOKEN = { id: "tok_1", name: "iOS Shortcut", itemCount: 3 };

function item(over: Partial<TokenSavedItem>): TokenSavedItem {
  return {
    id: "i1",
    title: "Saved thing",
    kind: "article",
    sourceUrl: "https://example.com/post",
    addedAt: new Date().toISOString(),
    ...over,
  };
}

function page(items: TokenSavedItem[], nextCursor: string | null = null) {
  return { ok: true, json: async () => ({ items, nextCursor }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TokenSavedItemsDialog", () => {
  it("lists the token's items, each opening on the dashboard", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        page([
          item({ id: "i1", title: "First" }),
          item({ id: "i2", title: null }),
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<TokenSavedItemsDialog token={TOKEN} onClose={vi.fn()} />);

    const first = await screen.findByRole("link", { name: /First/ });
    expect(first).toHaveAttribute("href", "/dashboard?item=i1");
    // An untitled save (still processing) falls back to its source's host
    expect(screen.getByRole("link", { name: /example\.com/ })).toHaveAttribute(
      "href",
      "/dashboard?item=i2",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/tokens/tok_1/items");
    expect(screen.getByText("Saved by iOS Shortcut")).toBeInTheDocument();
  });

  it("loads the next page on demand and appends it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([item({ id: "i1", title: "First" })], "c2"))
      .mockResolvedValueOnce(page([item({ id: "i2", title: "Second" })]));
    vi.stubGlobal("fetch", fetchMock);

    render(<TokenSavedItemsDialog token={TOKEN} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/tokens/tok_1/items?cursor=c2",
    );
    // Last page: nothing more to load
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when the token saved nothing that still exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([])));

    render(
      <TokenSavedItemsDialog
        token={{ ...TOKEN, itemCount: 0 }}
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("Nothing saved with this token yet"),
    ).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(page([item({ title: "Recovered" })]));
    vi.stubGlobal("fetch", fetchMock);

    render(<TokenSavedItemsDialog token={TOKEN} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Recovered")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument(),
    );
  });

  it("stays closed and fetches nothing without a token", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<TokenSavedItemsDialog token={null} onClose={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
