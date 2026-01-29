import type { Prisma } from "@prisma/client";
import { cache } from "react";
import db from "@/lib/db";
import { getAvailableInvites } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { getOAuthMetadata } from "@/lib/supabase/user-metadata";

// Fields we fetch from the Prisma User model
const userSelect = {
  username: true,
  avatarUrl: true,
  firstName: true,
  lastName: true,
  isAdmin: true,
} satisfies Prisma.UserSelect;

// AuthenticatedUser is a composite from 3 sources:
// 1. Prisma DB query via userSelect (firstName, lastName, username, avatarUrl)
// 2. Supabase auth session/metadata (no need to fetch from Prisma):
//    - id: already have from auth session, used as the Prisma lookup key
//    - email: auth is source of truth for login credentials
// 3. Computed (availableInvites - not a DB field, calculated at runtime)
export type AuthenticatedUser = Prisma.UserGetPayload<{
  select: typeof userSelect;
}> & {
  id: string;
  email: string | null;
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
    const { user, metadata } = await getOAuthMetadata(supabase);

    if (!user) return null;

    const [dbUser, availableInvites] = await Promise.all([
      db.user.findUnique({
        where: { id: user.id },
        select: userSelect,
      }),
      getAvailableInvites(user.id),
    ]);

    return {
      id: user.id,
      email: metadata.email,
      firstName: dbUser?.firstName ?? metadata.firstName,
      lastName: dbUser?.lastName ?? metadata.lastName,
      username: dbUser?.username ?? null,
      avatarUrl: dbUser?.avatarUrl ?? null,
      isAdmin: dbUser?.isAdmin ?? false,
      availableInvites,
    };
  },
);
