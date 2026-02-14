import type { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  // Supabase lifecycle, migrations, and test user creation are handled
  // by the run-e2e.ts wrapper script BEFORE Playwright starts.
  // This ensures env vars are available when playwright.config.ts is parsed.
}

export default globalSetup;
