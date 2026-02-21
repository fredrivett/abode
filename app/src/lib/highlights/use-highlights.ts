"use client";

import type { ArticleHighlight } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMilestoneStore } from "@/stores/milestone-store";
import { api } from "../api-client";

type HighlightResponse = Pick<
  ArticleHighlight,
  | "id"
  | "itemId"
  | "startOffset"
  | "endOffset"
  | "text"
  | "note"
  | "createdAt"
  | "updatedAt"
>;

type CreateHighlightPayload = {
  startOffset: number;
  endOffset: number;
  text: string;
  note?: string;
};

type UpdateHighlightPayload = {
  note?: string;
};

function highlightsQueryKey(itemId: string) {
  return ["items", itemId, "highlights"] as const;
}

/**
 * Fetches all highlights for an item via the API.
 *
 * @param enabled - Pass `false` to defer fetching until the article content is ready.
 */
export function useItemHighlights(itemId: string, enabled = true) {
  return useQuery<HighlightResponse[]>({
    queryKey: highlightsQueryKey(itemId),
    queryFn: () => api.get(`/api/v1/items/${itemId}/highlights`),
    enabled,
  });
}

/**
 * Creates a new highlight on an item and marks the `highlight_article` milestone on success.
 */
export function useCreateHighlight(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation<HighlightResponse, Error, CreateHighlightPayload>({
    mutationFn: (data) => api.post(`/api/v1/items/${itemId}/highlights`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: highlightsQueryKey(itemId) });
      useMilestoneStore.getState().markComplete("highlight_article");
    },
  });
}

/**
 * Updates an existing highlight (e.g. its note) and invalidates the highlights cache.
 */
export function useUpdateHighlight(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    HighlightResponse,
    Error,
    { highlightId: string } & UpdateHighlightPayload
  >({
    mutationFn: ({ highlightId, ...data }) =>
      api.patch(`/api/v1/items/${itemId}/highlights/${highlightId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: highlightsQueryKey(itemId) });
    },
  });
}

/**
 * Deletes a highlight by ID and invalidates the highlights cache.
 */
export function useDeleteHighlight(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (highlightId) =>
      api.delete(`/api/v1/items/${itemId}/highlights/${highlightId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: highlightsQueryKey(itemId) });
    },
  });
}
