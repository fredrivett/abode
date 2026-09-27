import type { ScanFilter } from "./filters";
import type { Quad } from "./geometry";
import type { Rotation } from "./warp";

/** A captured page: the original photo plus how to turn it into the scan */
export interface ScanPage {
  /** Fresh for every capture (retakes included) — previews are cached by id */
  id: string;
  /** Full-resolution camera frame (JPEG) */
  source: Blob;
  /** Page outline within `source`; null keeps the whole photo */
  quad: Quad | null;
  rotation: Rotation;
  filter: ScanFilter;
}

export type PagesAction =
  | { type: "add"; page: ScanPage }
  | { type: "replace"; id: string; page: ScanPage }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; to: number }
  | { type: "rotate"; id: string }
  | { type: "set-filter"; id: string; filter: ScanFilter };

const nextRotation: Record<Rotation, Rotation> = {
  0: 90,
  90: 180,
  180: 270,
  270: 0,
};

export function pagesReducer(
  pages: ScanPage[],
  action: PagesAction,
): ScanPage[] {
  switch (action.type) {
    case "add":
      return [...pages, action.page];
    case "replace":
      return pages.map((page) => (page.id === action.id ? action.page : page));
    case "remove":
      return pages.filter((page) => page.id !== action.id);
    case "move": {
      const from = pages.findIndex((page) => page.id === action.id);
      if (from === -1) return pages;
      const to = Math.max(0, Math.min(pages.length - 1, action.to));
      if (from === to) return pages;
      const next = [...pages];
      const [page] = next.splice(from, 1);
      next.splice(to, 0, page);
      return next;
    }
    case "rotate":
      return pages.map((page) =>
        page.id === action.id
          ? { ...page, rotation: nextRotation[page.rotation] }
          : page,
      );
    case "set-filter":
      return pages.map((page) =>
        page.id === action.id ? { ...page, filter: action.filter } : page,
      );
  }
}

/** Identifies one rendering of a page, so previews can be cached per look */
export function previewKey({
  page,
  filter = page.filter,
}: {
  page: ScanPage;
  filter?: ScanFilter;
}): string {
  return `${page.id}:${page.rotation}:${filter}`;
}
