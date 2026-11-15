import db, { type DbClient } from "@/lib/db";

/**
 * Check whether a user has completed signup by verifying they have a username.
 * `client` defaults to the viewer-scoped connection; pass `systemDb` to check
 * before the request's viewer is recorded.
 */
export async function hasCompletedSignup(
  userId: string,
  client: DbClient = db,
): Promise<boolean> {
  const dbUser = await client.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return !!dbUser?.username;
}
