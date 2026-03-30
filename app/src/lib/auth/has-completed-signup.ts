import db from "@/lib/db";

/**
 * Check whether a user has completed signup by verifying they have a username.
 */
export async function hasCompletedSignup(userId: string): Promise<boolean> {
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return !!dbUser?.username;
}
