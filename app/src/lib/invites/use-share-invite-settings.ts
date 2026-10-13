"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export type ShareInviteSettings = {
  allowShareInvites: boolean;
  availableInvites: number;
};

export const shareInviteSettingsQueryKey = ["user", "share-invites"] as const;

/**
 * Whether readers of the user's shared links can join with their invites (and
 * how many are left), plus an optimistic toggle. Shared by the share dialog and
 * Settings → Invites so both stay in sync.
 */
export function useShareInviteSettings({ enabled = true } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery<ShareInviteSettings>({
    queryKey: shareInviteSettingsQueryKey,
    queryFn: () => api.get("/api/v1/user/share-invites"),
    enabled,
  });

  const mutation = useMutation<
    unknown,
    Error,
    { allow: boolean; source: "share_dialog" | "settings" },
    { previous?: ShareInviteSettings }
  >({
    mutationFn: ({ allow }) =>
      api.patch("/api/v1/user/profile", { allowShareInvites: allow }),
    onMutate: async ({ allow }) => {
      await queryClient.cancelQueries({
        queryKey: shareInviteSettingsQueryKey,
      });
      const previous = queryClient.getQueryData<ShareInviteSettings>(
        shareInviteSettingsQueryKey,
      );
      if (previous) {
        queryClient.setQueryData(shareInviteSettingsQueryKey, {
          ...previous,
          allowShareInvites: allow,
        });
      }
      return { previous };
    },
    onSuccess: (_data, { allow, source }) => {
      posthog.capture("share_invites_toggled", { enabled: allow, source });
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(shareInviteSettingsQueryKey, context.previous);
      }
      toast.error("Failed to update setting");
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    setAllowShareInvites: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
