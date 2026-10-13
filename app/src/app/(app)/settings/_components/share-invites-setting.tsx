"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useShareInviteSettings } from "@/lib/invites/use-share-invite-settings";

/**
 * Settings → Invites toggle: let readers of the user's shared links join abode
 * with one of their invites (falling back to the waitlist when none are left).
 */
export function ShareInvitesSetting() {
  const { settings, setAllowShareInvites, isSaving } = useShareInviteSettings();

  return (
    <div className="mt-6 flex items-center justify-between gap-4 border-t pt-6">
      <div className="space-y-0.5">
        <Label htmlFor="allowShareInvites">
          Let readers of your shared links join
        </Label>
        <p className="text-muted-foreground text-xs">
          People reading something you&apos;ve shared can join abode with one of
          your invites. When you have none left, they join the waitlist instead.
        </p>
      </div>
      <Switch
        id="allowShareInvites"
        checked={settings?.allowShareInvites ?? true}
        disabled={!settings || isSaving}
        onCheckedChange={(checked) =>
          setAllowShareInvites({ allow: checked, source: "settings" })
        }
      />
    </div>
  );
}
