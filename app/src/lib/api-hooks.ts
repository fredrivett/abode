import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

// Example usage patterns for your API routes

// Generic query hook for GET requests
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

// Generic mutation hook for POST/PUT/PATCH/DELETE
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

// User profile
export function useUserProfile() {
  return useApiQuery<{ id: string; email: string; name?: string }>(
    "/api/v1/user/profile",
  );
}

// Items (for your items table)
export function useItems() {
  return useApiQuery<
    Array<{
      id: string;
      userId: string;
      kind: string;
      processingStatus: string;
      fileKey: string | null;
      meta: any;
      source: string | null;
      createdAt: string;
      updatedAt: string;
    }>
  >("/api/v1/items");
}

export function useCreateItem() {
  return useApiMutation<
    { id: string },
    { kind: string; fileKey?: string; meta?: any; source?: string }
  >((data) => api.post("/api/v1/items", data), {
    invalidateQueries: ["/api/v1/items"],
  });
}

export function useUpdateItem() {
  return useApiMutation<
    { id: string },
    {
      id: string;
      processingStatus?: string;
      fileKey?: string;
      meta?: any;
      source?: string;
    }
  >(({ id, ...data }) => api.patch(`/api/v1/items/${id}`, data), {
    invalidateQueries: ["/api/v1/items"],
  });
}

export function useDeleteItem() {
  return useApiMutation<void, { id: string }>(
    ({ id }) => api.delete(`/api/v1/items/${id}`),
    {
      invalidateQueries: ["/api/v1/items"],
    },
  );
}
