import type {
  ItemKind,
  Prisma,
  ProcessingStatus,
  SourceType,
} from "@prisma/client";
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import posthog from "posthog-js";
import { useCallback } from "react";
import type { SimilarImagesResponse } from "@/app/api/v1/items/[id]/similar/route";
import { api } from "./api-client";
import { itemQueryKey } from "./items/use-item";
import {
  chunk,
  DEFAULT_PAGE_SIZE,
  MAX_ITEM_IDS_PER_REQUEST,
} from "./pagination";
import type { Item, SearchItem } from "./types/item";

type ItemMeta = Prisma.JsonValue;

// Query key constants for consistent invalidation
export const ITEMS_QUERY_KEY = ["items"] as const;

/**
 * Returns a stable callback that invalidates all items queries in the React Query cache.
 * This refetches every loaded page of the list, so after a change to one known
 * item prefer {@link useReplaceCachedItem}, {@link useRemoveCachedItem} or
 * {@link useRefreshCachedItems}.
 */
export function useInvalidateItems() {
  const queryClient = useQueryClient();
  // Fire-and-forget: callers never await the refetch
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
  }, [queryClient]);
}

type ItemsByIdResponse = { items: Item[] };

/** A cached paginated list: the full items list or a search's results */
type CachedPages<T extends Item> = InfiniteData<{ items: T[]; total?: number }>;

/** Prefix of every search's results (`searchResultsQueryKey`) */
const SEARCH_RESULTS_KEY = ["items", "search"] as const;

/**
 * Rewrites one item wherever it appears in a cached list; `null` drops it and
 * counts it out of the first page's `total`. Returns the same object when the
 * item isn't there, so untouched queries don't re-render.
 */
function patchPages<T extends Item>(
  data: CachedPages<T> | undefined,
  itemId: string,
  patch: (item: T) => T | null,
): CachedPages<T> | undefined {
  if (!data) return data;
  let removed = 0;
  const pages = data.pages.map((page) => {
    if (!page.items.some(({ id }) => id === itemId)) return page;
    const items = page.items.flatMap((item) => {
      if (item.id !== itemId) return [item];
      const next = patch(item);
      if (next === null) removed++;
      return next === null ? [] : [next];
    });
    return { ...page, items };
  });
  if (pages.every((page, i) => page === data.pages[i])) return data;
  const [first] = pages;
  if (removed > 0 && first.total !== undefined) {
    pages[0] = { ...first, total: Math.max(0, first.total - removed) };
  }
  return { ...data, pages };
}

/** Whether `cached` was written after `fresh`, e.g. a slow response landing late */
function isNewer(cached: Item, fresh: Item) {
  return (
    cached.updatedAt !== undefined &&
    fresh.updatedAt !== undefined &&
    Date.parse(cached.updatedAt) > Date.parse(fresh.updatedAt)
  );
}

/**
 * Runs a cache patch now, and again whenever an items query that was already
 * fetching lands: an infinite query rebuilds its pages from the data it had
 * when the fetch started (a load-more, or a refetch of every page), so its
 * result would otherwise undo the patch.
 */
function patchNowAndAfterFetches(queryClient: QueryClient, patch: () => void) {
  patch();
  if (queryClient.isFetching({ queryKey: ITEMS_QUERY_KEY }) === 0) return;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.query.queryKey[0] !== "items") return;
    const { action } = event;
    // Its own writes (setQueryData) are `manual`; skip them, or it would loop
    if (action.type === "success" && !action.manual) patch();
    if (queryClient.isFetching({ queryKey: ITEMS_QUERY_KEY }) === 0) {
      unsubscribe();
    }
  });
}

function replaceCachedItem(queryClient: QueryClient, item: Item) {
  patchNowAndAfterFetches(queryClient, () =>
    writeCachedItem(queryClient, item),
  );
}

function removeCachedItem(queryClient: QueryClient, itemId: string) {
  patchNowAndAfterFetches(queryClient, () =>
    dropCachedItem(queryClient, itemId),
  );
}

function writeCachedItem(queryClient: QueryClient, item: Item) {
  queryClient.setQueryData<CachedPages<Item>>(ITEMS_QUERY_KEY, (old) =>
    patchPages(old, item.id, (cached) =>
      isNewer(cached, item) ? cached : item,
    ),
  );
  // Search results keep their match reasons
  queryClient.setQueriesData<CachedPages<SearchItem>>(
    { queryKey: SEARCH_RESULTS_KEY },
    (old) =>
      patchPages(old, item.id, (cached) =>
        isNewer(cached, item) ? cached : { ...cached, ...item },
      ),
  );
  queryClient.setQueryData<Item>(itemQueryKey(item.id), (old) =>
    old && !isNewer(old, item) ? item : old,
  );
}

function dropCachedItem(queryClient: QueryClient, itemId: string) {
  queryClient.setQueryData<CachedPages<Item>>(ITEMS_QUERY_KEY, (old) =>
    patchPages(old, itemId, () => null),
  );
  queryClient.setQueriesData<CachedPages<SearchItem>>(
    { queryKey: SEARCH_RESULTS_KEY },
    (old) => patchPages(old, itemId, () => null),
  );
  // Other items' "similar images" strips
  queryClient.setQueriesData<SimilarImagesResponse>(
    { predicate: ({ queryKey }) => queryKey[2] === "similar" },
    (old) =>
      old?.items.some(({ id }) => id === itemId)
        ? { ...old, items: old.items.filter(({ id }) => id !== itemId) }
        : old,
  );
  // Its own detail, similar images and highlights
  queryClient.removeQueries({ queryKey: ["items", itemId] });
}

/**
 * A change can move an item into or out of a search (e.g. a tag removed under a
 * `@tag:` filter), which only the server can decide: refetch the search on
 * screen, and mark the others stale.
 */
function invalidateSearchResults(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: SEARCH_RESULTS_KEY });
}

/**
 * Returns a stable callback that writes an item the API just returned (e.g. a
 * PATCH response) into every cached copy of it: the list, search results and
 * its detail. The grid updates at once, without refetching every loaded page.
 * A copy written after this one is kept.
 */
export function useReplaceCachedItem() {
  const queryClient = useQueryClient();
  return useCallback(
    (item: Item) => {
      replaceCachedItem(queryClient, item);
      invalidateSearchResults(queryClient);
    },
    [queryClient],
  );
}

/**
 * Returns a stable callback that drops a deleted item from every cache that
 * holds it, so its tile leaves the grid at once and the counts drop by one.
 */
export function useRemoveCachedItem() {
  const queryClient = useQueryClient();
  return useCallback(
    (itemId: string) => removeCachedItem(queryClient, itemId),
    [queryClient],
  );
}

/**
 * Returns a stable callback that refetches just the given items
 * (`GET /api/v1/items?ids=`) and writes them into the caches, dropping any that
 * no longer exist. For changes whose response isn't the item (retry, reassign,
 * location edits) and for the processing poll. When a fetch fails it falls
 * back to refetching the whole list, and resolves `false` so a caller can also
 * try again.
 */
export function useRefreshCachedItems() {
  const queryClient = useQueryClient();
  return useCallback(
    async (itemIds: string[]): Promise<boolean> => {
      const results = await Promise.allSettled(
        chunk(itemIds, MAX_ITEM_IDS_PER_REQUEST).map(async (ids) => {
          const { items } = await api.get<ItemsByIdResponse>(
            `/api/v1/items?ids=${encodeURIComponent(ids.join(","))}`,
          );
          for (const item of items) replaceCachedItem(queryClient, item);
          const found = new Set(items.map(({ id }) => id));
          for (const id of ids) {
            if (!found.has(id)) removeCachedItem(queryClient, id);
          }
        }),
      );
      invalidateSearchResults(queryClient);
      const ok = results.every(({ status }) => status === "fulfilled");
      if (!ok)
        void queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
      return ok;
    },
    [queryClient],
  );
}

/** Waits before each re-check when a created item isn't in the list yet */
export const CREATED_ITEM_RETRY_DELAYS_MS = [500, 1500, 4000];

/**
 * Returns a stable callback for after creating an item: fetches it and puts it
 * at the top of the loaded full list, then re-checks until it's still there, so
 * the grid can't silently miss it until a reload — the fetch can fail, or a
 * list refetch already in flight can land without it. If it never shows up,
 * reports it.
 */
export function useRevealCreatedItem() {
  const queryClient = useQueryClient();
  return useCallback(
    async (itemId: string): Promise<void> => {
      // No list loaded counts as listed: its first fetch includes the item
      const isListed = () =>
        queryClient
          .getQueryData<InfiniteData<ItemsPageResponse>>(ITEMS_QUERY_KEY)
          ?.pages.some((page) => page.items.some(({ id }) => id === itemId)) ??
        true;
      for (let attempt = 0; ; attempt++) {
        if (isListed()) return;
        const delay = CREATED_ITEM_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        try {
          const {
            items: [item],
          } = await api.get<ItemsByIdResponse>(`/api/v1/items?ids=${itemId}`);
          if (item) {
            prependToList(queryClient, item);
            invalidateSearchResults(queryClient);
          }
        } catch {
          // Tried again after the delay
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      posthog.captureException(
        new Error("Created item missing from the items list"),
        { itemId },
      );
    },
    [queryClient],
  );
}

/** Puts a just-created item first in the full list (newest `addedAt` sorts first) */
function prependToList(queryClient: QueryClient, item: Item) {
  queryClient.setQueryData<InfiniteData<ItemsPageResponse>>(
    ITEMS_QUERY_KEY,
    (old) => {
      const first = old?.pages[0];
      if (!old || !first) return old;
      if (
        old.pages.some((page) => page.items.some(({ id }) => id === item.id))
      ) {
        return old;
      }
      const pages = [
        {
          ...first,
          items: [item, ...first.items],
          ...(first.total !== undefined && { total: first.total + 1 }),
        },
        ...old.pages.slice(1),
      ];
      return { ...old, pages };
    },
  );
}

// Response type for paginated items
type ItemsPageResponse = {
  items: Item[];
  cursor: string | null;
  hasMore: boolean;
  total?: number;
};

// Initial data type for SSR hydration
type ItemsInitialData = {
  items: Item[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
};

/**
 * Infinite query hook for paginated items list.
 * Supports SSR hydration via ssrData prop.
 */
export function useItemsInfinite(ssrData?: ItemsInitialData) {
  return useInfiniteQuery({
    queryKey: ITEMS_QUERY_KEY,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", String(DEFAULT_PAGE_SIZE));
      const url = `/api/v1/items${params.toString() ? `?${params.toString()}` : ""}`;
      return api.get<ItemsPageResponse>(url);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.cursor : undefined,
    initialData:
      ssrData !== undefined
        ? {
            pages: [ssrData],
            pageParams: [null],
          }
        : undefined,
  });
}

/**
 * Returns a stable callback that patches a single note item's content directly
 * in the items cache — no refetch. Use after saving a note edit so the grid
 * card and a re-opened detail view reflect the change without reloading every
 * loaded page from the API.
 */
export function useUpdateCachedNoteContent() {
  const queryClient = useQueryClient();
  return useCallback(
    (itemId: string, content: string) => {
      queryClient.setQueryData<InfiniteData<ItemsPageResponse>>(
        ITEMS_QUERY_KEY,
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) =>
                    item.id === itemId && item.noteDetails
                      ? {
                          ...item,
                          noteDetails: { ...item.noteDetails, content },
                        }
                      : item,
                  ),
                })),
              }
            : old,
      );
    },
    [queryClient],
  );
}

/**
 * Returns a stable callback that patches a single item's title directly in the
 * items cache — no refetch. Use after a rename so the grid card (which derives
 * its name from the cached item) updates instantly, the same way the per-card
 * dialog used to update its tile via shared state. Also patches the single-item
 * detail cache so reopening an off-grid item (resolved via {@link useItem})
 * shows the new title rather than a stale one.
 */
export function useUpdateCachedItemTitle() {
  const queryClient = useQueryClient();
  return useCallback(
    (itemId: string, title: string) => {
      queryClient.setQueryData<InfiniteData<ItemsPageResponse>>(
        ITEMS_QUERY_KEY,
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) =>
                    item.id === itemId ? { ...item, title } : item,
                  ),
                })),
              }
            : old,
      );
      queryClient.setQueryData<Item>(itemQueryKey(itemId), (old) =>
        old ? { ...old, title } : old,
      );
    },
    [queryClient],
  );
}

// Example usage patterns for your API routes

/**
 * Generic React Query wrapper for GET requests.
 * Uses the URL as the query key, so identical URLs share a cache entry.
 *
 * @param url - The API endpoint to fetch.
 * @param options - Optional React Query settings (enabled, staleTime, cacheTime).
 */
export function useApiQuery<T>(
  url: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  },
) {
  return useQuery<T>({
    queryKey: [url],
    enabled: options?.enabled,
    staleTime: options?.staleTime,
    gcTime: options?.cacheTime,
  });
}

/**
 * Generic React Query mutation wrapper.
 * Automatically invalidates the specified query keys on success so dependent
 * queries refetch fresh data.
 *
 * @param mutationFn - The async function that performs the API call.
 * @param options - Callbacks and an optional list of query keys to invalidate on success.
 */
export function useApiMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    invalidateQueries?: string[];
  },
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: (data, variables) => {
      // Invalidate specified queries to refetch fresh data
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      }
      options?.onSuccess?.(data, variables);
    },
    onError: options?.onError,
  });
}

// Example domain-specific hooks (replace with your actual API routes)

/** Fetches the authenticated user's profile. */
export function useUserProfile() {
  return useApiQuery<{ id: string; email: string; name?: string }>(
    "/api/v1/user/profile",
  );
}

/** Fetches all items for the authenticated user. */
export function useItems() {
  return useApiQuery<
    Array<{
      id: string;
      userId: string;
      kind: ItemKind | null;
      processingStatus: ProcessingStatus;
      fileKey: string | null;
      meta: ItemMeta | null;
      sourceType: SourceType | null;
      createdAt: string;
      updatedAt: string;
    }>
  >("/api/v1/items");
}

/** Creates a new item and invalidates the items query cache. */
export function useCreateItem() {
  return useApiMutation<
    { id: string },
    {
      kind?: ItemKind;
      fileKey?: string;
      meta?: ItemMeta;
      sourceType?: SourceType;
    }
  >((data) => api.post("/api/v1/items", data), {
    invalidateQueries: ["/api/v1/items"],
  });
}

/** Deletes an item and invalidates the items query cache. */
export function useDeleteItem() {
  return useApiMutation<void, { id: string }>(
    ({ id }) => api.delete(`/api/v1/items/${id}`),
    {
      invalidateQueries: ["/api/v1/items"],
    },
  );
}
