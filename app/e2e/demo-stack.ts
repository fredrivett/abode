/**
 * Isolated stack for recording PR demos (`.agents/skills/record-pr-demo`): the
 * e2e Supabase (own containers and ports, derived from CONDUCTOR_PORT), a seeded
 * test user and a dev server on its own port and build dir. Recordings never touch
 * the shared local DB or the dev server the user is watching, and only ever show
 * test data, which matters because demo videos are public.
 *
 * It is the same stack `test:e2e` uses, so don't run both at once in one checkout.
 *
 *   bun run demo:stack   start it; stays in the foreground, Ctrl-C / SIGTERM stops it all
 *   bun run demo:stop    stop the Supabase containers if a run was killed without cleanup
 */
import { type ChildProcess, spawn } from "node:child_process";
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
const READY_TIMEOUT_MS = 180_000;

const basePort = Number.parseInt(process.env.CONDUCTOR_PORT || "3300", 10);
// Same offsets as playwright.config.ts: +5 is the shadow DB port, never bound at runtime
const serverPort = basePort + 5;
const smtpPort = basePort + 4;
const baseUrl = `http://localhost:${serverPort}`;

function log(message: string) {
  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(`[demo-stack] ${message}`);
}

async function ensureUsers(
  apiUrl: string,
  serviceRoleKey: string,
  dbUrl: string,
) {
  const adminClient = createAdminClient(apiUrl, serviceRoleKey);
  const { data, error } = await adminClient.auth.admin.listUsers();
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  const existing = new Set(data.users.map((user) => user.email));

  for (const user of Object.values(TEST_USERS)) {
    if (existing.has(user.email)) continue;
    await createTestUser(adminClient, dbUrl, user);
  }
}

async function waitForServer(server: ChildProcess) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Dev server exited with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/login`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `Dev server not ready at ${baseUrl} after ${READY_TIMEOUT_MS / 1000}s`,
  );
}

async function main() {
  if (process.argv[2] === "stop") {
    stopTestSupabase();
    return;
  }

  let server: ChildProcess | undefined;
  let stopping = false;
  const shutdown = (code: number) => {
    if (stopping) return;
    stopping = true;
    log("stopping");
    server?.kill("SIGTERM");
    stopTestSupabase();
    process.exit(code);
  };
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  try {
    startTestSupabase();
    const status = getTestSupabaseStatus();
    runPrismaMigrations(status.DB_URL);
    await ensureUsers(status.API_URL, status.SERVICE_ROLE_KEY, status.DB_URL);

    server = spawn("bun", ["run", "dev"], {
      cwd: APP_DIR,
      stdio: "inherit",
      env: {
        ...process.env,
        CONDUCTOR_PORT: String(serverPort),
        // Own build dir so this server doesn't fight a running `bun run dev` or an
        // e2e run over `.next/dev/lock`
        NEXT_DIST_DIR: ".next-demo",
        NEXT_DEV_INDICATORS: "false",
        DATABASE_URL: status.DB_URL,
        DIRECT_URL: status.DB_URL,
        NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
        RESEND_API_KEY: "re_demo_placeholder_not_real",
        LOCAL_SMTP_PORT: String(smtpPort),
      },
    });
    server.on("exit", (code) => {
      if (!stopping) {
        log(`dev server exited (code ${code})`);
        shutdown(code ?? 1);
      }
    });

    await waitForServer(server);
    const user = TEST_USERS.default;
    log(`ready at ${baseUrl}`);
    log(`log in as ${user.email} / ${user.password}`);
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: CLI script needs stderr output
    console.error("[demo-stack] failed:", error);
    shutdown(1);
  }
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI script needs stderr output
  console.error("[demo-stack] failed:", err);
  process.exit(1);
});
