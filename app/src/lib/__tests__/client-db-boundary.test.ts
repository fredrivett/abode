import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No "use client" module may reach `@/lib/db` through value imports. The signup
 * forms once pulled the Prisma client into the browser bundle via a shared
 * username helper; harmless until the client gained an extension built at
 * module load, which throws in the browser and crashed both pages. Server
 * actions are cut off at the boundary — client bundles only get references.
 */

const SRC_DIR = join(process.cwd(), "src");
const DB_MODULE = "lib/db.ts";

// Value imports/re-exports (multi-line ok); `import type` is erased at build
const IMPORT_SPECIFIER =
  /^\s*(?:import|export)\s+(?!type\b)(?:[^;'"]*?\sfrom\s+)?["']([^"']+)["']/gm;

function toFile(path: string): string {
  return relative(SRC_DIR, path).split(sep).join("/");
}

function resolveImport({
  specifier,
  importer,
}: {
  specifier: string;
  importer: string;
}): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC_DIR, specifier.slice(2));
  else if (specifier.startsWith(".")) {
    base = join(SRC_DIR, dirname(importer), specifier);
  } else return null;

  const candidates = [".ts", ".tsx", "/index.ts", "/index.tsx"].map(
    (suffix) => base + suffix,
  );
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ? toFile(found) : null;
}

const sourceCache = new Map<string, string>();
function source(file: string): string {
  let text = sourceCache.get(file);
  if (text === undefined) {
    text = readFileSync(join(SRC_DIR, file), "utf8");
    sourceCache.set(file, text);
  }
  return text;
}

function hasDirective({
  file,
  directive,
}: {
  file: string;
  directive: string;
}): boolean {
  return new RegExp(`^\\s*["']${directive}["']`).test(source(file));
}

function valueImports(file: string): string[] {
  return [...source(file).matchAll(IMPORT_SPECIFIER)]
    .map(([, specifier]) => resolveImport({ specifier, importer: file }))
    .filter((resolved) => resolved !== null);
}

/** The import chain from `entry` to the db module, or null if unreachable. */
function chainToDb(entry: string): string[] | null {
  const queue: string[][] = [[entry]];
  const seen = new Set([entry]);
  while (queue.length > 0) {
    const chain = queue.shift() ?? [];
    const file = chain[chain.length - 1];
    if (file === DB_MODULE) return chain;
    if (file !== entry && hasDirective({ file, directive: "use server" })) {
      continue;
    }
    for (const next of valueImports(file)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...chain, next]);
      }
    }
  }
  return null;
}

describe("client/server boundary", () => {
  it("no client component imports the Prisma client, even transitively", () => {
    const clientFiles = readdirSync(SRC_DIR, {
      recursive: true,
      encoding: "utf8",
    })
      .map((path) => path.split(sep).join("/"))
      .filter(
        (file) =>
          /\.tsx?$/.test(file) &&
          !/\.(test|stories)\.tsx?$/.test(file) &&
          hasDirective({ file, directive: "use client" }),
      );
    expect(clientFiles.length).toBeGreaterThan(0);

    const leaks = clientFiles
      .map(chainToDb)
      .filter((chain) => chain !== null)
      .map((chain) => chain.join(" -> "));
    expect(leaks).toEqual([]);
  });
});
