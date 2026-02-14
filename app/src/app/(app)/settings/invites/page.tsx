import { redirect } from "next/navigation";
import { getAvailableInvites, getUserInvites } from "@/lib/invites";
import { getAuthUser } from "@/lib/supabase/server";
import { InviteSettings } from "../_components/invite-settings";

export default async function InvitesSettingsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const [availableInvites, invites] = await Promise.all([
    getAvailableInvites(user.id),
    getUserInvites(user.id),
  ]);

  return (
    <div className="space-y-6">
      <InviteSettings
        availableInvites={availableInvites}
        initialInvites={invites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          status: invite.effectiveStatus,
          createdAt: invite.createdAt.toISOString(),
          expiresAt: invite.expiresAt.toISOString(),
          acceptedAt: invite.acceptedAt?.toISOString() ?? null,
          acceptedByUser: invite.acceptedByUser
            ? {
                username: invite.acceptedByUser.username,
                firstName: invite.acceptedByUser.firstName,
                lastName: invite.acceptedByUser.lastName,
                avatarUrl: invite.acceptedByUser.avatarUrl,
              }
            : null,
          userDeleted: !!invite.userDeleted,
          inviterDeleted: !!invite.inviterDeleted,
        }))}
      />
    </div>
  );
}
