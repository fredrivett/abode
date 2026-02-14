import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

export interface TestUser {
	id: string;
	email: string;
	password: string;
	username: string;
}

const DEFAULT_PASSWORD = "test-password-123!";

let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
	if (!adminClient) {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!url || !key) {
			throw new Error(
				"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
			);
		}
		adminClient = createClient(url, key, {
			auth: { autoRefreshToken: false, persistSession: false },
		});
	}
	return adminClient;
}

/**
 * Create a confirmed user via Supabase admin API + Prisma.
 * Use this for inviter/setup users that need to be ready to log in immediately.
 * Each test should use unique emails for isolation (e.g., "t1-inviter-a@test.local").
 */
export async function createUser(opts: {
	email: string;
	username: string;
	password?: string;
}): Promise<TestUser> {
	const password = opts.password ?? DEFAULT_PASSWORD;
	const client = getAdminClient();

	const { data, error } = await client.auth.admin.createUser({
		email: opts.email,
		password,
		email_confirm: true,
		user_metadata: { pending_username: opts.username },
	});

	if (error) {
		throw new Error(`Failed to create user ${opts.email}: ${error.message}`);
	}

	// The handle_new_user trigger creates a public.users row.
	// Update username and mark onboarding complete via Prisma.
	const prisma = new PrismaClient({
		datasources: { db: { url: process.env.DATABASE_URL } },
	});

	try {
		await prisma.user.update({
			where: { id: data.user.id },
			data: { username: opts.username, onboardingCompletedAt: new Date() },
		});
	} finally {
		await prisma.$disconnect();
	}

	return {
		id: data.user.id,
		email: opts.email,
		password,
		username: opts.username,
	};
}
