import { cache } from "react";
import db from "@/lib/db";
import { getAvailableInvites } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
  availableInvites: number;
};

/**
 * Get the authenticated user with all profile data.
 * Uses React cache() to deduplicate calls within a single request.
 *
 * Data priority: DB values take precedence over OAuth metadata.
 *
 * Returns null if not authenticated.
 */
export const getAuthenticatedUser = cache(
  async (): Promise<AuthenticatedUser | null> => {
    const supabase = await createClient();
    const { user, metadata } = await getUserWithMetadata(supabase);

    if (!user) return null;

    const [dbUser, availableInvites] = await Promise.all([
      db.user.findUnique({
        where: { id: user.id },
        select: {
          username: true,
          avatarUrl: true,
          firstName: true,
          lastName: true,
        },
      }),
      getAvailableInvites(user.id),
    ]);

    return {
      id: user.id,
      email: metadata.email,
      firstName: dbUser?.firstName ?? metadata.firstName,
      lastName: dbUser?.lastName ?? metadata.lastName,
      username: dbUser?.username ?? metadata.username,
      avatarUrl: dbUser?.avatarUrl ?? metadata.avatarUrl,
      availableInvites,
    };
  },
);
