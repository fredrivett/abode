import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api-client";
import { itemQueryKey, useItem } from "./use-item";

vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn() } }));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => vi.mocked(api.get).mockReset());

describe("useItem", () => {
  it("keys the query under the items namespace for prefix invalidation", () => {
    expect(itemQueryKey("abc")).toEqual(["items", "abc", "detail"]);
  });

  it("fetches the item by id and returns it", async () => {
    vi.mocked(api.get).mockResolvedValue({ id: "abc", title: "Hi" });
    const { result } = renderHook(() => useItem("abc"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/api/v1/items/abc");
    expect(result.current.data).toEqual({ id: "abc", title: "Hi" });
  });

  it("does not fetch when itemId is null", () => {
    renderHook(() => useItem(null), { wrapper: wrapper() });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useItem("abc", false), { wrapper: wrapper() });
    expect(api.get).not.toHaveBeenCalled();
  });
});
