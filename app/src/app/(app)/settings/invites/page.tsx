import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getAvailableInvites } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import { InviteSettings } from "../_components/invite-settings";

export default async function InvitesSettingsPage() {
  const supabase = await createClient();
  const { user } = await getUserWithMetadata(supabase);

  if (!user) {
    redirect("/login");
  }

  const [dbUser, availableInvites] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        sentInvites: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            createdAt: true,
            expiresAt: true,
            acceptedAt: true,
          },
        },
      },
    }),
    getAvailableInvites(user.id),
  ]);

  return (
    <div className="space-y-6">
      <InviteSettings
        availableInvites={availableInvites}
        initialInvites={(dbUser?.sentInvites ?? []).map((invite) => ({
          ...invite,
          createdAt: invite.createdAt.toISOString(),
          expiresAt: invite.expiresAt.toISOString(),
          acceptedAt: invite.acceptedAt?.toISOString() ?? null,
          status: invite.acceptedAt
            ? "accepted"
            : invite.expiresAt < new Date()
              ? "expired"
              : "pending",
        }))}
      />
    </div>
  );
}
