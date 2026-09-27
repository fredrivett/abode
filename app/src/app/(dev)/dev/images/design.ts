import { z } from "zod";
import {
  GALLERY_CARDS,
  type GalleryCard,
} from "@/app/(marketing)/_components/gallery-data";
import { type FormatId, isFormatId } from "./formats";

// The canvas the hero's scatter was tuned against (X header), and the homepage
// grid card width at that viewport — the width flying cards are drawn at
const REFERENCE_WIDTH = 1500;
const REFERENCE_HEIGHT = 500;
const REFERENCE_CARD_WIDTH = 347;

const cardConfigSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
  x: z.number(),
  y: z.number(),
  scale: z.number(),
  rot: z.number(),
  blur: z.number(),
  /** Background-colour veil over the card (0–1) — fades without see-through */
  fade: z.number(),
  z: z.number(),
});

export const designSchema = z.object({
  name: z.string().min(1),
  format: z.custom<FormatId>((v) => typeof v === "string" && isFormatId(v)),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  theme: z.enum(["light", "dark"]),
  headlineSize: z.number(),
  taglineSize: z.number(),
  taglineGap: z.number(),
  showTagline: z.boolean(),
  highlight: z.boolean(),
  textWidth: z.number().positive(),
  textX: z.number(),
  textY: z.number(),
  cardWidth: z.number().positive(),
  bookTile: z.boolean(),
  showGuide: z.boolean(),
  cards: z.array(cardConfigSchema),
});

export type CardConfig = z.infer<typeof cardConfigSchema>;
export type Design = z.infer<typeof designSchema>;
export type SavedDesign = { slug: string; design: Design };

type Canvas = { width: number; height: number };

/** The homepage hero's resting scatter, mapped onto a canvas */
export function defaultCardConfig(
  card: GalleryCard,
  { width, height }: Canvas,
): CardConfig {
  const s = card.scatter;
  return {
    id: card.id,
    visible: true,
    x: Math.round(s.x * width),
    y: Math.round(s.y * height),
    scale: s.scale,
    rot: s.rot,
    // Books drop their tile, so a blur would soften the cover itself
    blur: card.kind === "book" ? 0 : s.blur,
    fade: s.opacity >= 0.9 ? 0 : Math.round((1 - s.opacity) * 100) / 100,
    z: s.z,
  };
}

/** A fresh hero-style design, with sizes scaled from the X header reference */
export function defaultDesign({
  name,
  format,
  width,
  height,
}: {
  name: string;
  format: FormatId;
} & Canvas): Design {
  const fit = Math.min(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT);
  const textScale = Math.min(Math.max(height / REFERENCE_HEIGHT, 0.8), 1.6);
  return {
    name,
    format,
    width,
    height,
    theme: "dark",
    headlineSize: Math.round(60 * textScale),
    taglineSize: Math.round(24 * textScale),
    taglineGap: Math.round(24 * textScale),
    showTagline: true,
    highlight: true,
    // The hero's max-w-2xl column less its px-4, so the headline wraps the same
    textWidth: Math.max(1, Math.min(Math.round(640 * textScale), width - 80)),
    textX: 0,
    textY: 0,
    cardWidth: Math.round(REFERENCE_CARD_WIDTH * fit),
    bookTile: false,
    showGuide: true,
    cards: GALLERY_CARDS.map((card) =>
      defaultCardConfig(card, { width, height }),
    ),
  };
}

/**
 * Parses a saved design, or null when it's malformed. Cards are reconciled
 * against GALLERY_CARDS so added cards get defaults and removed ones drop.
 */
export function parseDesign(raw: string): Design | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = designSchema.safeParse(json);
  if (!parsed.success) return null;
  const design = parsed.data;
  const saved = new Map(design.cards.map((c) => [c.id, c]));
  return {
    ...design,
    cards: GALLERY_CARDS.map(
      (card) => saved.get(card.id) ?? defaultCardConfig(card, design),
    ),
  };
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slugs name the design's file, so they're restricted to a safe charset */
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Filename-safe slug from a design name, suffixed to avoid `taken` ones */
export function slugForName({
  name,
  taken,
}: {
  name: string;
  taken: readonly string[];
}): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image";
  let slug = base;
  for (let n = 2; taken.includes(slug); n++) slug = `${base}-${n}`;
  return slug;
}
