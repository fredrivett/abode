import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getE2EPrisma } from "./db";

const MIGRATIONS_DIR = join(__dirname, "../../../supabase/migrations");

/**
 * Split a migration into single statements (Prisma's raw execution takes one
 * at a time). Drops `--` comments, then splits on `;` outside `$$` bodies so
 * DO blocks stay whole — enough for our own idempotent storage migrations.
 */
export function splitSqlStatements(sql: string): string[] {
  const code = sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  const statements: string[] = [];
  let current = "";
  let inDollarBody = false;
  for (let i = 0; i < code.length; i++) {
    if (code.startsWith("$$", i)) {
      inDollarBody = !inDollarBody;
      current += "$$";
      i++;
      continue;
    }
    if (code[i] === ";" && !inDollarBody) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += code[i];
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

/**
 * Apply `supabase/migrations` (storage buckets + policies) to the e2e database.
 * The e2e stack only runs Prisma migrations, so specs that exercise storage
 * policies apply these themselves; every file is idempotent, so re-running is
 * harmless.
 */
export async function applySupabaseMigrations(): Promise<void> {
  const prisma = getE2EPrisma();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of splitSqlStatements(sql)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
}
