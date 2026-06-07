#!/usr/bin/env bun
/**
 * Keeps the Commands table in AGENTS.md in sync with package.json scripts.
 *
 *  1. Every `bun run <script>` documented in the table must be a real script.
 *  2. Every script must be either documented in the table or in the allowlist
 *     below — so adding a script forces a deliberate "document it or skip it".
 *
 * Run by CI (and `bun run check:commands-doc`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Scripts intentionally NOT in the Commands table (internal / rarely agent-run).
// Adding a new script means either documenting it in AGENTS.md or listing it here.
const UNDOCUMENTED_ALLOWLIST = new Set([
  "start",
  "lint:all",
  "lint:suppressions",
  "fix:unsafe",
  "format",
  "test:watch",
  "test:ui",
  "test:coverage:unit",
  "test:e2e:ui",
  "ts",
  "storybook:build",
  "prisma:deploy",
  "check:commands-doc",
  "supabase:start",
  "supabase:stop",
  "supabase:status",
  "supabase:studio",
]);

const appDir = join(import.meta.dir, "..");
const repoRoot = join(appDir, "..");

const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));
const scripts = new Set<string>(Object.keys(pkg.scripts ?? {}));

const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");

// Isolate the "## Commands" section (up to the next "## " heading).
const section =
  agents.split(/^## /m).find((s) => s.startsWith("Commands")) ?? "";

const documented = new Set<string>();
for (const m of section.matchAll(/`bun run ([a-z0-9:_-]+)/gi)) {
  documented.add(m[1]);
}

const errors: string[] = [];

for (const cmd of documented) {
  if (!scripts.has(cmd)) {
    errors.push(
      `Documented in AGENTS.md but missing from package.json scripts: bun run ${cmd}`,
    );
  }
}

for (const s of scripts) {
  if (!documented.has(s) && !UNDOCUMENTED_ALLOWLIST.has(s)) {
    errors.push(
      `Script not documented in the AGENTS.md Commands table (document it, or add to UNDOCUMENTED_ALLOWLIST): ${s}`,
    );
  }
}

if (errors.length > 0) {
  console.error(
    "✖ AGENTS.md Commands table is out of sync with package.json:\n",
  );
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    "\nUpdate the Commands table in AGENTS.md, or the allowlist in app/scripts/check-commands-doc.ts.",
  );
  process.exit(1);
}

console.log("✓ AGENTS.md Commands table is in sync with package.json scripts.");
