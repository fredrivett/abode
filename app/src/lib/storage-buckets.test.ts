import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_AVATAR_SIZE } from "@/lib/avatar";
import {
  AVATARS_BUCKET_MAX_BYTES,
  BUCKET_SIZE_LIMIT_MB,
  ITEMS_BUCKET_MAX_BYTES,
} from "@/lib/storage-buckets";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_PDF_UPLOAD_BYTES } from "@/lib/uploads";

/**
 * Storage rejects an object over its bucket's `file_size_limit`, so an upload
 * cap above it lets a file through validation that then fails at upload (a
 * 25MB PDF cap once sat over the 15MB `items` bucket). Bucket limits live only
 * in migration SQL, split across supabase/migrations and prisma/migrations, so
 * this replays them to check the TS mirror in storage-buckets.ts.
 */

const appDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIB = 1024 * 1024;

function migrationsInOrder(): { name: string; sql: string }[] {
  const supabaseDir = join(appDir, "../supabase/migrations");
  const prismaDir = join(appDir, "prisma/migrations");
  const files = [
    ...readdirSync(supabaseDir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => ({ name, path: join(supabaseDir, name) })),
    ...readdirSync(prismaDir)
      .map((name) => ({ name, path: join(prismaDir, name, "migration.sql") }))
      .filter(({ path }) => existsSync(path)),
  ];
  // Both name migrations with a leading YYYYMMDDHHMMSS timestamp
  return files
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, path }) => ({ name, sql: readFileSync(path, "utf8") }));
}

/** Split on commas outside quotes and ARRAY[...] brackets */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const char of list) {
    if (char === "'") quoted = !quoted;
    if (!quoted && char === "[") depth++;
    if (!quoted && char === "]") depth--;
    if (!quoted && depth === 0 && char === ",") {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

/** A literal limit; anything else (expressions, quoted strings) fails loudly */
function parseLimit({
  value,
  migration,
}: {
  value: string;
  migration: string;
}): number | null {
  if (/^NULL$/i.test(value)) return null;
  if (/^\d+$/.test(value)) return Number(value);
  throw new Error(
    `${migration} sets file_size_limit to \`${value}\`, which this test can't replay; extend parseLimit`,
  );
}

/** Each bucket's `file_size_limit` after every migration has run */
function bucketLimitsFromMigrations(): Map<string, number | null> {
  const limits = new Map<string, number | null>();
  const insert =
    /INSERT INTO storage\.buckets\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*?)\)\s*(ON CONFLICT \(id\) DO NOTHING)?\s*;/gi;
  const update =
    /UPDATE storage\.buckets\s+SET\s+([\s\S]*?)\s+WHERE\s+id\s*=\s*'([^']+)'\s*;/gi;

  for (const { name, sql: raw } of migrationsInOrder()) {
    const sql = raw.replace(/--[^\n]*/g, "");
    const mentions = sql.match(/storage\.buckets/gi)?.length ?? 0;
    // Statements in file order, so an insert and update in one file replay right
    const statements = [
      ...[...sql.matchAll(insert)].map((m) => ({ kind: "insert", m })),
      ...[...sql.matchAll(update)].map((m) => ({ kind: "update", m })),
    ].sort((a, b) => (a.m.index ?? 0) - (b.m.index ?? 0));

    if (statements.length !== mentions) {
      throw new Error(
        `${name} touches storage.buckets in a form this test can't replay; extend bucketLimitsFromMigrations`,
      );
    }

    for (const { kind, m } of statements) {
      if (kind === "insert") {
        const columns = splitTopLevel(m[1]);
        const values = splitTopLevel(m[2]);
        const id = values[columns.indexOf("id")].replace(/'/g, "");
        const limitIndex = columns.indexOf("file_size_limit");
        const limit =
          limitIndex === -1
            ? null
            : parseLimit({ value: values[limitIndex], migration: name });
        // ON CONFLICT DO NOTHING leaves an existing bucket as it was
        if (!m[3] || !limits.has(id)) limits.set(id, limit);
      } else {
        const assignment = splitTopLevel(m[1]).find((part) =>
          /^file_size_limit\s*=/i.test(part),
        );
        if (assignment) {
          const value = assignment.replace(/^file_size_limit\s*=\s*/i, "");
          limits.set(m[2], parseLimit({ value, migration: name }));
        }
      }
    }
  }
  return limits;
}

describe("storage bucket size limits", () => {
  it("match the limits the bucket migrations set", () => {
    const fromMigrations = Object.fromEntries(
      [...bucketLimitsFromMigrations()].filter(([, limit]) => limit !== null),
    );
    const mirrored = Object.fromEntries(
      Object.entries(BUCKET_SIZE_LIMIT_MB).map(([id, mb]) => [id, mb * MIB]),
    );
    expect(mirrored).toEqual(fromMigrations);
  });

  it("bound every upload cap", () => {
    expect(MAX_IMAGE_UPLOAD_BYTES).toBeLessThanOrEqual(ITEMS_BUCKET_MAX_BYTES);
    expect(MAX_PDF_UPLOAD_BYTES).toBeLessThanOrEqual(ITEMS_BUCKET_MAX_BYTES);
    expect(MAX_AVATAR_SIZE).toBeLessThanOrEqual(AVATARS_BUCKET_MAX_BYTES);
  });
});
