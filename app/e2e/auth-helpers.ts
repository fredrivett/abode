import type { SupabaseClient } from "@supabase/supabase-js";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  username: string;
}

export const TEST_USERS = {
  default: {
    email: "e2e-user@test.local",
    password: "test-password-123!",
    username: "e2e_test_user",
  },
} as const;

export async function createTestUser(
  adminClient: SupabaseClient,
  databaseUrl: string,
  user: { email: string; password: string; username: string },
): Promise<TestUser> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      pending_username: user.username,
    },
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  // The handle_new_user trigger fires on auth.users INSERT,
  // creating a public.users row with id + email.
  // Now update the username via Prisma.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    await prisma.user.update({
      where: { id: data.user.id },
      data: { username: user.username, onboardingCompletedAt: new Date() },
    });
  } finally {
    await prisma.$disconnect();
  }

  return {
    id: data.user.id,
    email: user.email,
    password: user.password,
    username: user.username,
  };
}
