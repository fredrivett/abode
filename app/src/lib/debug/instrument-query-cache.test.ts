import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  instrumentQueryCache,
  summarizeQueryData,
} from "./instrument-query-cache";
import { resetTrace, traceNames } from "./test-utils";
import { getTraceEvents } from "./trace";

describe("summarizeQueryData", () => {
  it("counts pages and items for infinite queries", () => {
    expect(
      summarizeQueryData({
        pages: [{ items: [1, 2] }, { items: [3] }],
        pageParams: [null, "c"],
      }),
    ).toEqual({ pages: 2, items: 3 });
  });

  it("summarises lists, single records, and primitives", () => {
    expect(summarizeQueryData([1, 2, 3])).toEqual({ length: 3 });
    expect(summarizeQueryData({ items: [1] })).toEqual({ items: 1 });
    expect(summarizeQueryData({ id: "abc", title: "x" })).toEqual({
      id: "abc",
    });
    expect(summarizeQueryData(null)).toEqual({ type: "null" });
    expect(summarizeQueryData({ a: 1, b: 2 })).toEqual({ keys: ["a", "b"] });
  });
});

describe("instrumentQueryCache", () => {
  let queryClient: QueryClient;
  let uninstall: () => void;

  beforeEach(() => {
    resetTrace();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    uninstall = instrumentQueryCache(queryClient);
  });

  afterEach(() => {
    uninstall();
    queryClient.clear();
    resetTrace({ enabled: false });
  });

  it("records fetch → success with a data summary", async () => {
    await queryClient.fetchQuery({
      queryKey: ["items"],
      queryFn: async () => ({ items: [1, 2, 3] }),
    });
    expect(traceNames()).toEqual(["query:fetch", "query:success"]);
    expect(getTraceEvents()[1].data).toEqual({
      queryKey: '["items"]',
      items: 3,
    });
  });

  it("distinguishes setQueryData from a network success", () => {
    queryClient.setQueryData(["items", "abc", "detail"], { id: "abc" });
    expect(traceNames()).toEqual(["query:setData"]);
  });

  it("records invalidations", async () => {
    queryClient.setQueryData(["items"], { items: [] });
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    expect(traceNames()).toContain("query:invalidate");
  });

  it("records errors with the message", async () => {
    await queryClient
      .fetchQuery({
        queryKey: ["boom"],
        queryFn: async () => {
          throw new Error("nope");
        },
      })
      .catch(() => {});
    expect(getTraceEvents().at(-1)).toMatchObject({
      event: "error",
      data: { message: "nope" },
    });
  });
});
