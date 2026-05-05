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
import { useProdServer } from "./use-prod-server";

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

    const defaultUser = TEST_USERS.default;

    const sharedEnv = {
      ...process.env,
      DATABASE_URL: status.DB_URL,
      DIRECT_URL: status.DB_URL,
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      RESEND_API_KEY: "re_e2e_placeholder_not_real",
      TEST_USER_EMAIL: defaultUser.email,
      TEST_USER_PASSWORD: defaultUser.password,
      LOCAL_SMTP_PORT: String(
        Number.parseInt(process.env.CONDUCTOR_PORT || "3300", 10) + 4,
      ),
    };

    if (useProdServer) {
      execSync("bun run build", {
        stdio: "inherit",
        cwd: APP_DIR,
        env: sharedEnv,
      });
    }

    execSync(`bunx playwright test ${playwrightArgs}`, {
      stdio: "inherit",
      cwd: APP_DIR,
      env: sharedEnv,
    });
  } finally {
    stopTestSupabase();
  }
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI script needs stderr output
  console.error("E2E run failed:", err);
  process.exit(1);
});
