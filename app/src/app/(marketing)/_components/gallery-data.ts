// Demo items for the marketing "living gallery". Mirrors the shape of real
// abode items (kinds, auto-derived tags/colours/objects) but is hand-built from
// the seed data so the logged-out landing page can render statically without
// Supabase or the app's item stores. Swap for real data later if the premise
// holds.

export type GalleryColor = { hex: string; name: string };

/** What abode auto-understood about an item — revealed on hover. */
export type Insight = {
  /** Human label for the detected kind, e.g. "photo", "article". */
  kindLabel: string;
  tags: string[];
  colors?: GalleryColor[];
  objects?: string[];
};

/**
 * Where a card floats before it settles into the grid, hand-tuned per item so
 * the hero composition holds. Position is anchored to the viewport edges (x/y
 * as fractions of the viewport) keeping the centre clear; depth varies — distant
 * cards are smaller, blurred, fainter and sit further back (lower z).
 */
export type Scatter = {
  x: number;
  y: number;
  scale: number;
  blur: number;
  opacity: number;
  rot: number;
  z: number;
  /** Drift amplitude (px) and period (ms), phase-offset so neighbours desync. */
  amp: number;
  period: number;
  phase: number;
};

type Base = {
  id: string;
  insight: Insight;
  scatter: Scatter;
};

export type GalleryCard = Base &
  (
    | {
        kind: "image";
        src: string;
        width: number;
        height: number;
        title: string;
        animated?: boolean;
      }
    | {
        kind: "tweet";
        author: string;
        handle: string;
        avatar: string;
        text: string;
      }
    | { kind: "note"; title?: string; body: string }
    | { kind: "book"; cover: string; title: string; author: string }
    | {
        kind: "video";
        thumbnail: string;
        title: string;
        channel: string;
        duration: string;
      }
    | {
        kind: "article";
        title: string;
        domain: string;
        author: string;
        readingTime: number;
      }
    | {
        kind: "product";
        image: string;
        title: string;
        brand: string;
        price: string;
        domain: string;
      }
  );

export const GALLERY_CARDS: GalleryCard[] = [
  {
    kind: "image",
    id: "red-arch",
    src: "/gallery/red-arch-sculpture.jpg",
    width: 1920,
    height: 2400,
    title: "Red Arch Sculpture",
    // near, left-lower
    scatter: {
      x: 0.01,
      y: 0.44,
      scale: 0.8,
      blur: 0,
      opacity: 0.95,
      rot: -4,
      z: 30,
      amp: 10,
      period: 7000,
      phase: 0,
    },
    insight: {
      kindLabel: "photo",
      objects: ["bridge", "sculpture", "building", "water"],
      colors: [
        { hex: "#D93A1E", name: "red" },
        { hex: "#3E6E8C", name: "blue" },
        { hex: "#1A1A1A", name: "black" },
      ],
      tags: ["architecture", "sculpture", "city", "bridge"],
    },
  },
  {
    kind: "tweet",
    id: "maps-tweet",
    author: "Cora Meridian",
    handle: "corameridian",
    avatar: "https://api.dicebear.com/9.x/glass/svg?seed=corameridian",
    text: "Every map is out of date the moment it's printed.",
    // mid, right-upper
    scatter: {
      x: 0.79,
      y: 0.08,
      scale: 0.66,
      blur: 2,
      opacity: 0.8,
      rot: 5,
      z: 20,
      amp: 8,
      period: 6200,
      phase: 1.4,
    },
    insight: {
      kindLabel: "tweet",
      tags: ["maps", "cartography", "design"],
    },
  },
  {
    kind: "note",
    id: "note-to-self",
    body: "the best tools feel like they remember you — you shouldn't have to reintroduce yourself every time you come home.",
    // far, left — below the sunset image, clear of it
    scatter: {
      x: 0.04,
      y: 0.34,
      scale: 0.5,
      blur: 5,
      opacity: 0.55,
      rot: -8,
      z: 6,
      amp: 6,
      period: 8200,
      phase: 2.6,
    },
    insight: {
      kindLabel: "note",
      tags: ["idea", "product", "thought"],
    },
  },
  {
    kind: "video",
    id: "tiny-desk",
    thumbnail: "https://i.ytimg.com/vi/4iQmPv_dTI0/hqdefault.jpg",
    title: "Fred again..: Tiny Desk Concert",
    channel: "NPR Music",
    duration: "26:00",
    // near, right-lower
    scatter: {
      x: 0.72,
      y: 0.6,
      scale: 0.82,
      blur: 0,
      opacity: 0.95,
      rot: 4,
      z: 30,
      amp: 10,
      period: 6600,
      phase: 0.8,
    },
    insight: {
      kindLabel: "video",
      tags: ["music", "live", "electronic", "concert"],
    },
  },
  {
    kind: "image",
    id: "city-sunset",
    src: "/gallery/city-sunset-river.jpg",
    width: 1920,
    height: 2558,
    title: "City Sunset over the River",
    // mid, left-upper — smaller so the note clears it below
    scatter: {
      x: 0.05,
      y: 0.04,
      scale: 0.52,
      blur: 3,
      opacity: 0.7,
      rot: -6,
      z: 15,
      amp: 7,
      period: 7400,
      phase: 3.3,
    },
    insight: {
      kindLabel: "photo",
      objects: ["sky", "building", "water", "boat"],
      colors: [
        { hex: "#E67A3C", name: "orange" },
        { hex: "#2B3A5C", name: "dark blue" },
        { hex: "#14161F", name: "black" },
      ],
      tags: ["sunset", "skyline", "river", "silhouette"],
    },
  },
  {
    kind: "book",
    id: "wind-in-the-willows",
    cover: "/gallery/book-wind-in-the-willows.jpg",
    title: "The Wind in the Willows",
    author: "Kenneth Grahame",
    // near, right-mid
    scatter: {
      x: 0.84,
      y: 0.36,
      scale: 0.78,
      blur: 0.5,
      opacity: 0.9,
      rot: 6,
      z: 28,
      amp: 9,
      period: 6900,
      phase: 4.1,
    },
    insight: {
      kindLabel: "book",
      tags: ["fiction", "classic", "children"],
    },
  },
  {
    kind: "article",
    id: "start-a-startup",
    title: "How to Start a Startup",
    domain: "paulgraham.com",
    author: "Paul Graham",
    readingTime: 25,
    // far, bottom-left
    scatter: {
      x: 0.15,
      y: 0.82,
      scale: 0.52,
      blur: 5,
      opacity: 0.55,
      rot: 7,
      z: 7,
      amp: 6,
      period: 8600,
      phase: 1.9,
    },
    insight: {
      kindLabel: "article",
      tags: ["startups", "essay", "entrepreneurship", "advice"],
    },
  },
  {
    kind: "image",
    id: "muybridge",
    src: "/gallery/muybridge-horse.gif",
    width: 498,
    height: 374,
    title: "The Horse in Motion",
    animated: true,
    // mid, bottom-right
    scatter: {
      x: 0.69,
      y: 0.85,
      scale: 0.6,
      blur: 3,
      opacity: 0.7,
      rot: -5,
      z: 14,
      amp: 7,
      period: 7700,
      phase: 5.0,
    },
    insight: {
      kindLabel: "photo",
      objects: ["horse", "person", "animal"],
      colors: [
        { hex: "#E8E4DA", name: "off-white" },
        { hex: "#2A2622", name: "black" },
        { hex: "#8A857C", name: "gray" },
      ],
      tags: ["animation", "history", "motion", "vintage"],
    },
  },
  {
    kind: "product",
    id: "turntable",
    image: "/gallery/turntable.png",
    title: "AT-LP120XUSB Direct-Drive Turntable",
    brand: "Audio-Technica",
    price: "£299",
    domain: "audio-technica.com",
    // far, top-right
    scatter: {
      x: 0.88,
      y: 0.68,
      scale: 0.48,
      blur: 6,
      opacity: 0.5,
      rot: 8,
      z: 5,
      amp: 5,
      period: 9000,
      phase: 2.2,
    },
    insight: {
      kindLabel: "product",
      tags: ["turntable", "vinyl", "audio", "music"],
    },
  },
];
