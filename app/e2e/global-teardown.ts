import type { FullConfig } from "@playwright/test";

async function globalTeardown(_config: FullConfig) {
	// Supabase teardown is handled by the run-e2e.ts wrapper script's
	// finally block AFTER Playwright exits.
}

export default globalTeardown;
