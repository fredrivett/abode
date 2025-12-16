/**
 * Mock data for filter autocomplete.
 * This simulates what we'd get from Typesense faceted search.
 * Replace with actual API calls when backend is wired up.
 */

import type { FilterType } from "./types";

// Mock tags - common photo categories
const MOCK_TAGS = [
  "landscape",
  "portrait",
  "nature",
  "urban",
  "architecture",
  "food",
  "travel",
  "street",
  "wildlife",
  "macro",
  "sunset",
  "sunrise",
  "beach",
  "mountain",
  "forest",
  "ocean",
  "city",
  "night",
  "black-and-white",
  "abstract",
  "minimalist",
  "vintage",
  "documentary",
  "event",
  "family",
];

// Mock objects - things detected by AI
const MOCK_OBJECTS = [
  "person",
  "car",
  "tree",
  "building",
  "dog",
  "cat",
  "bird",
  "flower",
  "sky",
  "water",
  "mountain",
  "road",
  "bridge",
  "boat",
  "airplane",
  "bicycle",
  "motorcycle",
  "train",
  "bus",
  "chair",
  "table",
  "computer",
  "phone",
  "book",
  "food",
];

// Mock colors - dominant colors in hex
const MOCK_COLORS = [
  "#FF5733", // red-orange
  "#33FF57", // green
  "#3357FF", // blue
  "#FF33F5", // magenta
  "#33FFF5", // cyan
  "#F5FF33", // yellow
  "#000000", // black
  "#FFFFFF", // white
  "#808080", // gray
  "#8B4513", // brown
  "#FFD700", // gold
  "#4B0082", // indigo
  "#FF69B4", // pink
  "#00CED1", // dark cyan
  "#FF4500", // orange-red
];

// Mock sources
const MOCK_SOURCES = [
  "camera-roll",
  "instagram",
  "screenshot",
  "download",
  "airdrop",
  "email",
  "messages",
  "safari",
  "chrome",
  "slack",
  "figma",
];

// Mock types (item kinds)
const MOCK_TYPES = [
  "image",
  // Future types could include: "video", "document", "audio", etc.
];

/**
 * Get mock filter values for a given filter type.
 * Simulates an async API call with a small delay.
 */
export async function getMockFilterValues(type: FilterType): Promise<string[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  switch (type) {
    case "tag":
      return MOCK_TAGS;
    case "object":
      return MOCK_OBJECTS;
    case "color":
      return MOCK_COLORS;
    case "source":
      return MOCK_SOURCES;
    case "type":
      return MOCK_TYPES;
    case "date":
      // Date filter uses calendar picker, not value list
      return [];
    default:
      return [];
  }
}
