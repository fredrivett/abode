import type {
  ItemKind,
  Prisma,
  ProcessingStatus,
  SourceType,
} from "@prisma/client";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "./api-client";
import { DEFAULT_PAGE_SIZE } from "./pagination";
import type { Item } from "./types/item";

type ItemMeta = Prisma.JsonValue;

// Query key constants for consistent invalidation
export const ITEMS_QUERY_KEY = ["items"] as const;

/**
 * Returns a stable callback that invalidates all items queries in the React Query cache.
 * Useful for triggering a refetch after mutations that affect the items list.
 */
export function useInvalidateItems() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY }),
    [queryClient],
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
 * items cache — no refetch. Use after a rename so the grid card and the
 * URL-driven tab title reflect the new name immediately.
 */
export function useUpdateCachedItemTitle() {
  const queryClient = useQueryClient();
  return useCallback(
    ({ itemId, title }: { itemId: string; title: string }) => {
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
          queryClient.invalidateQueries({ queryKey: [queryKey] });
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

/** Updates an existing item and invalidates the items query cache. */
export function useUpdateItem() {
  return useApiMutation<
    { id: string },
    {
      id: string;
      processingStatus?: ProcessingStatus;
      fileKey?: string;
      meta?: ItemMeta;
      sourceType?: SourceType;
    }
  >(({ id, ...data }) => api.patch(`/api/v1/items/${id}`, data), {
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
