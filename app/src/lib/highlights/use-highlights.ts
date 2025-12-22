"use client";

import type { ArticleHighlight } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useItemHighlights(itemId: string, enabled = true) {
  return useQuery<HighlightResponse[]>({
    queryKey: highlightsQueryKey(itemId),
    queryFn: () => api.get(`/api/v1/items/${itemId}/highlights`),
    enabled,
  });
}

export function useCreateHighlight(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation<HighlightResponse, Error, CreateHighlightPayload>({
    mutationFn: (data) => api.post(`/api/v1/items/${itemId}/highlights`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: highlightsQueryKey(itemId) });
    },
  });
}

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
