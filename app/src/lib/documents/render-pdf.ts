import { ProcessingFailure } from "@/lib/items/processing-error";
import { usableTextLayer } from "./pdf-text";

/**
 * Safety ceiling on a PDF's pages. Not a product limit — real documents are far
 * below it — but a small file can declare thousands of blank pages, each of
 * which becomes a stored image and a slice of the import's run time.
 */
export const MAX_PDF_PAGES = 1000;

/** Longest side of a rendered page: sharp on a retina viewer, legible to OCR */
const RENDER_MAX_SIDE_PX = 2000;
/** Upper bound on resolution, so a small page (a receipt) isn't blown up */
const RENDER_MAX_DPI = 200;
const JPEG_QUALITY = 82;

export interface RenderedPdfPage {
  jpeg: Uint8Array;
  width: number;
  height: number;
  /** The page's embedded text, or null when it has none worth using (a scan) */
  text: string | null;
}

export interface OpenedPdf {
  pageCount: number;
  /** Render one page (0-based). Pages are rendered one at a time to bound memory */
  renderPage(index: number): RenderedPdfPage;
  close(): void;
}

// A PDF's header must appear within its first 1KB
function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

/**
 * Open a PDF for rendering. Throws `ProcessingFailure("file_unreadable")` when
 * the bytes aren't a PDF, are damaged past repair, or are password-protected,
 * and `ProcessingFailure("document_too_long")` past {@link MAX_PDF_PAGES}.
 */
export async function openPdf(bytes: Uint8Array): Promise<OpenedPdf> {
  if (!hasPdfHeader(bytes)) {
    throw new ProcessingFailure("file_unreadable", "Not a PDF");
  }
  // Loaded on demand: it instantiates a ~10MB WebAssembly module on import,
  // which only this path needs
  const mupdf = await import("mupdf");

  let doc: InstanceType<typeof mupdf.Document>;
  try {
    doc = mupdf.Document.openDocument(bytes, "application/pdf");
  } catch (error) {
    throw new ProcessingFailure(
      "file_unreadable",
      `PDF couldn't be opened: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const fail = (
    reason: "file_unreadable" | "document_too_long",
    message: string,
  ) => {
    doc.destroy();
    return new ProcessingFailure(reason, message);
  };
  if (doc.needsPassword()) throw fail("file_unreadable", "PDF is encrypted");
  const pageCount = doc.countPages();
  if (pageCount < 1) throw fail("file_unreadable", "PDF has no pages");
  if (pageCount > MAX_PDF_PAGES) {
    throw fail(
      "document_too_long",
      `PDF has ${pageCount} pages (max ${MAX_PDF_PAGES})`,
    );
  }

  return {
    pageCount,
    renderPage(index) {
      const page = doc.loadPage(index);
      try {
        const [x0, y0, x1, y1] = page.getBounds();
        const longestSidePt = Math.max(x1 - x0, y1 - y0, 1);
        const scale = Math.min(
          RENDER_MAX_DPI / 72,
          RENDER_MAX_SIDE_PX / longestSidePt,
        );
        const pixmap = page.toPixmap(
          mupdf.Matrix.scale(scale, scale),
          mupdf.ColorSpace.DeviceRGB,
          false,
          true,
        );
        const text = page.toStructuredText("preserve-whitespace");
        try {
          return {
            // Copied out of the WebAssembly heap by mupdf, so it outlives the pixmap
            jpeg: pixmap.asJPEG(JPEG_QUALITY),
            width: pixmap.getWidth(),
            height: pixmap.getHeight(),
            text: usableTextLayer(text.asText()),
          };
        } finally {
          text.destroy();
          pixmap.destroy();
        }
      } finally {
        page.destroy();
      }
    },
    close() {
      doc.destroy();
    },
  };
}
