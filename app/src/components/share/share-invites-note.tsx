"use client";

import { Ticket } from "lucide-react";
import { useShareInviteSettings } from "@/lib/invites/use-share-invite-settings";

/**
 * Whether readers of the link can join abode with one of the sharer's invites,
 * with a quick way to turn it off (also in Settings → Invites).
 */
export function ShareInvitesNote({ enabled }: { enabled: boolean }) {
  const { settings, setAllowShareInvites, isSaving } = useShareInviteSettings({
    enabled,
  });
  if (!settings) return null;

  const { allowShareInvites, availableInvites } = settings;
  const toggle = (
    <button
      type="button"
      className="cursor-pointer underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      disabled={isSaving}
      onClick={() =>
        setAllowShareInvites({
          allow: !allowShareInvites,
          source: "share_dialog",
        })
      }
    >
      {allowShareInvites ? "Turn off" : "Turn on"}
    </button>
  );

  return (
    <p className="-mt-3 flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
      <Ticket className="size-3.5" />
      {!allowShareInvites
        ? "Readers can't join abode with your invites."
        : availableInvites > 0
          ? `Readers can join abode with one of your invites (${availableInvites} left).`
          : "You're out of invites, so readers will join the waitlist."}{" "}
      {toggle}
    </p>
  );
}
