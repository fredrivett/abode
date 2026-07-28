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

type Base = {
  id: string;
  /** Column-span weight for the masonry drift (all cards break-inside-avoid). */
  insight: Insight;
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
    insight: {
      kindLabel: "tweet",
      tags: ["maps", "cartography", "design"],
    },
  },
  {
    kind: "note",
    id: "reading-list",
    title: "Reading list",
    body: "Books to get through this quarter — start with the Alexander, everyone keeps referencing it.",
    insight: {
      kindLabel: "note",
      tags: ["reading", "books", "to-do"],
    },
  },
  {
    kind: "video",
    id: "tiny-desk",
    thumbnail: "https://i.ytimg.com/vi/4iQmPv_dTI0/hqdefault.jpg",
    title: "Fred again..: Tiny Desk Concert",
    channel: "NPR Music",
    duration: "26:00",
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
    id: "moby-dick",
    cover: "/gallery/book-moby-dick.jpg",
    title: "Moby-Dick; or, The Whale",
    author: "Herman Melville",
    insight: {
      kindLabel: "book",
      tags: ["fiction", "classic", "adventure"],
    },
  },
  {
    kind: "article",
    id: "start-a-startup",
    title: "How to Start a Startup",
    domain: "paulgraham.com",
    author: "Paul Graham",
    readingTime: 25,
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
    title: "AT-LP120XUSB Direct-Drive Turntable",
    brand: "Audio-Technica",
    price: "£299",
    domain: "audio-technica.com",
    insight: {
      kindLabel: "product",
      tags: ["turntable", "vinyl", "audio", "music"],
    },
  },
];
