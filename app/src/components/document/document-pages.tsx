import { IsLoading } from "@/components/ui/is-loading";
import type { DocumentPageSummary } from "@/lib/documents/document-pages";
import { getProxyImageUrl } from "@/lib/image-url";

interface DocumentPagesProps {
  /** Pages in reading order; null until they've loaded */
  pages: DocumentPageSummary[] | null;
  /** From the item's meta, so the count shows before the pages load */
  pageCount: number;
  /** Page 1's image, shown while the rest load (or if they fail to) */
  coverUrl: string | null;
  status: "loading" | "error" | "ready";
  title: string;
}

function Page({
  src,
  width,
  height,
  label,
  alt,
}: {
  src: string;
  width?: number;
  height?: number;
  label: string;
  alt: string;
}) {
  return (
    <figure className="w-full max-w-3xl space-y-2">
      {/* biome-ignore lint/performance/noImgElement: page images come through the item image proxy */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className="h-auto w-full bg-white shadow-lg"
      />
      <figcaption className="text-center text-white/60 text-xs">
        {label}
      </figcaption>
    </figure>
  );
}

/** A scanned document's pages, top to bottom, like a PDF viewer */
export function DocumentPages({
  pages,
  pageCount,
  coverUrl,
  status,
  title,
}: DocumentPagesProps) {
  const label = (index: number) => `Page ${index + 1} of ${pageCount}`;

  return (
    <div className="flex w-full flex-col items-center gap-6 overflow-y-auto p-4 md:h-full md:p-8">
      {pages && status === "ready"
        ? pages.map((page, index) => (
            <Page
              key={page.fileKey}
              src={getProxyImageUrl(page.fileKey, "detail")}
              width={page.width}
              height={page.height}
              label={label(index)}
              alt={`${title}, page ${index + 1}`}
            />
          ))
        : coverUrl && (
            <Page src={coverUrl} label={label(0)} alt={`${title}, page 1`} />
          )}
      {status === "loading" ? (
        <IsLoading label="Loading pages" className="text-sm text-white/70" />
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-white/70">
          Couldn't load the rest of this document's pages.
        </p>
      ) : null}
    </div>
  );
}
