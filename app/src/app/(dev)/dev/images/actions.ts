"use server";

import { getAppBaseUrl } from "@/lib/url";
import { type Design, designSchema, isValidSlug, slugForName } from "./design";
import {
  deleteDesign as deleteDesignFile,
  listDesigns,
  writeDesign,
} from "./design-files";

type ActionResult = { success?: boolean; error?: string };
type CreateDesignResult = { slug?: string; error?: string };
type ExportImageResult = { png?: string; error?: string };

const DEV_ONLY = { error: "Only available in development" };

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function parseInput({
  slug,
  design,
}: {
  slug: string;
  design: unknown;
}): { design: Design } | { error: string } {
  if (!isDev()) return DEV_ONLY;
  if (!isValidSlug(slug)) return { error: "Invalid design slug" };
  const parsed = designSchema.safeParse(design);
  return parsed.success ? { design: parsed.data } : { error: "Invalid design" };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Persists a design to its committed JSON file (dev only) */
export async function saveDesign(
  slug: string,
  design: unknown,
): Promise<ActionResult> {
  const input = parseInput({ slug, design });
  if ("error" in input) return input;
  try {
    await writeDesign({ slug, design: input.design });
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error, "Write failed") };
  }
}

/** Saves a new design under a slug derived from its name, kept unique */
export async function createDesign(
  design: unknown,
): Promise<CreateDesignResult> {
  if (!isDev()) return DEV_ONLY;
  const parsed = designSchema.safeParse(design);
  if (!parsed.success) return { error: "Invalid design" };
  try {
    const taken = (await listDesigns()).map((d) => d.slug);
    const slug = slugForName({ name: parsed.data.name, taken });
    await writeDesign({ slug, design: parsed.data });
    return { slug };
  } catch (error) {
    return { error: errorMessage(error, "Create failed") };
  }
}

export async function deleteDesign(slug: string): Promise<ActionResult> {
  if (!isDev()) return DEV_ONLY;
  if (!isValidSlug(slug)) return { error: "Invalid design slug" };
  try {
    await deleteDesignFile(slug);
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error, "Delete failed") };
  }
}

/**
 * Saves the design, then screenshots its render view in headless Chromium and
 * returns the PNG as base64. A real browser keeps blur, 3D books and fonts
 * faithful where DOM-to-canvas libraries don't.
 */
export async function exportDesignImage(
  slug: string,
  design: unknown,
  pixelRatio: number,
): Promise<ExportImageResult> {
  const input = parseInput({ slug, design });
  if ("error" in input) return input;
  const { width, height } = input.design;
  try {
    // Saved first so the render view (which reads the file) matches the editor
    await writeDesign({ slug, design: input.design });
  } catch (error) {
    return { error: errorMessage(error, "Write failed") };
  }

  // Dev-only dependency (via @playwright/test); Next keeps it out of the bundle
  const { chromium } = await import("playwright");
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: pixelRatio === 2 ? 2 : 1,
    });
    const response = await page.goto(
      `${getAppBaseUrl()}/dev/images?design=${slug}&render=1`,
      { waitUntil: "networkidle" },
    );
    // goto resolves on error pages too — don't export a screenshot of one
    if (!response?.ok()) {
      throw new Error(`Render returned ${response?.status() ?? "no response"}`);
    }
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
    return { png: png.toString("base64") };
  } catch (error) {
    return { error: errorMessage(error, "Screenshot failed") };
  } finally {
    await browser?.close();
  }
}
