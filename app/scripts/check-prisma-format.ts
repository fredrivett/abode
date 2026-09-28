#!/usr/bin/env bun
/**
 * Fails when prisma/schema.prisma isn't `prisma format`-clean. Prisma 6's
 * `format` has no --check flag, so this formats a temp copy and compares —
 * the real schema is never touched, so uncommitted edits don't trip it.
 *
 * Run by CI (and `bun run check:prisma-format`); fix with `bun run prisma:format`.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(appDir, "prisma", "schema.prisma");

/** Returns an error message when the schema isn't formatted, or null when it is */
function checkFormatted(tempSchema: string): string | null {
  copyFileSync(schemaPath, tempSchema);
  const result = spawnSync(
    "bun",
    ["x", "prisma", "format", "--schema", tempSchema],
    { cwd: appDir, encoding: "utf8" },
  );
  if (result.status !== 0) {
    return `${result.stderr || result.stdout}\nprisma format failed — is the schema valid?`;
  }
  if (readFileSync(tempSchema, "utf8") !== readFileSync(schemaPath, "utf8")) {
    return "prisma/schema.prisma is not formatted. Run `bun run prisma:format` from ./app.";
  }
  return null;
}

const tempDir = mkdtempSync(join(tmpdir(), "prisma-format-check-"));
let error: string | null;
try {
  error = checkFormatted(join(tempDir, "schema.prisma"));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (error) {
  console.error(error);
  process.exit(1);
}
console.log("prisma/schema.prisma is formatted.");
