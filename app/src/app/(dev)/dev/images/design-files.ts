import "server-only";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "@/lib/logger.server";
import { isValidSlug, parseDesign, type SavedDesign } from "./design";

const logger = createLogger("image-studio");

// One committed JSON file per design, so layouts are versioned. Resolved from
// the app root (the dev server's cwd).
export const DESIGNS_DIR = path.join(
  process.cwd(),
  "src/app/(dev)/dev/images/designs",
);

// Pending write per file — each write waits for the previous one, so saves
// land in the order they were made
const writeQueues = new Map<string, Promise<void>>();

function designPath({ slug, dir }: { slug: string; dir: string }): string {
  if (!isValidSlug(slug)) throw new Error(`Invalid design slug: ${slug}`);
  return path.join(dir, `${slug}.json`);
}

/** Every valid design on disk, sorted by name; malformed files are skipped */
export async function listDesigns(dir = DESIGNS_DIR): Promise<SavedDesign[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const designs: SavedDesign[] = [];
  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    if (!file.endsWith(".json") || !isValidSlug(slug)) continue;
    const design = parseDesign(await readFile(path.join(dir, file), "utf8"));
    if (design) designs.push({ slug, design });
    else logger.warn("Skipping malformed design file", { file });
  }
  return designs.sort((a, b) => a.design.name.localeCompare(b.design.name));
}

export async function writeDesign(
  { slug, design }: SavedDesign,
  dir = DESIGNS_DIR,
): Promise<void> {
  const file = designPath({ slug, dir });
  const write = (writeQueues.get(file) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await mkdir(dir, { recursive: true });
      await writeFile(file, `${JSON.stringify(design, null, 2)}\n`);
    });
  writeQueues.set(file, write);
  try {
    await write;
  } finally {
    if (writeQueues.get(file) === write) writeQueues.delete(file);
  }
}

export async function deleteDesign(
  slug: string,
  dir = DESIGNS_DIR,
): Promise<void> {
  await rm(designPath({ slug, dir }));
}
