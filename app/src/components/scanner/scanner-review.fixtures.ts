import type { ScanPage } from "@/lib/scanner/pages";
import { previewKey } from "@/lib/scanner/pages";
import type { PagePreview } from "./use-page-previews";

/** Inline SVG "scanned page" so stories and tests render offline */
function pageSvg(lines: number): string {
  const rows = Array.from(
    { length: lines },
    (_, i) =>
      `<rect x="40" y="${60 + i * 28}" width="${200 + ((i * 37) % 120)}" height="10" fill="#111"/>`,
  ).join("");
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="594"><rect width="420" height="594" fill="#fff"/>${rows}</svg>`,
  )}`;
}

export function samplePages(count: number): {
  pages: ScanPage[];
  previews: ReadonlyMap<string, PagePreview>;
} {
  const pages: ScanPage[] = Array.from({ length: count }, (_, i) => ({
    id: `page-${i + 1}`,
    source: new Blob(),
    quad: null,
    rotation: 0,
    filter: "bw",
  }));
  const previews = new Map(
    pages.map((page, i) => [
      previewKey({ page }),
      { url: pageSvg(8 + i * 4), width: 420, height: 594 },
    ]),
  );
  return { pages, previews };
}
