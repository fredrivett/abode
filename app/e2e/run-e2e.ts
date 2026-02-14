import { execSync } from "node:child_process";
import path from "node:path";
import { createTestUser, TEST_USERS } from "./auth-helpers";
import {
	createAdminClient,
	getTestSupabaseStatus,
	runPrismaMigrations,
	startTestSupabase,
	stopTestSupabase,
} from "./supabase-setup";

const APP_DIR = path.resolve(__dirname, "..");

async function main() {
	try {
		startTestSupabase();
		const status = getTestSupabaseStatus();
		runPrismaMigrations(status.DB_URL);

		const adminClient = createAdminClient(
			status.API_URL,
			status.SERVICE_ROLE_KEY,
		);

		for (const userData of Object.values(TEST_USERS)) {
			await createTestUser(adminClient, status.DB_URL, userData);
		}

		const playwrightArgs = process.argv.slice(2).join(" ");

		execSync(`bunx playwright test ${playwrightArgs}`, {
			stdio: "inherit",
			cwd: APP_DIR,
			env: {
				...process.env,
				DATABASE_URL: status.DB_URL,
				DIRECT_URL: status.DB_URL,
				NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
				NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
				SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
				RESEND_API_KEY: "re_e2e_placeholder_not_real",
			},
		});
	} finally {
		stopTestSupabase();
	}
}

main().catch(() => {
	process.exit(1);
});
