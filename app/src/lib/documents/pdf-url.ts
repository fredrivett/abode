import { PDF_MIME_TYPE } from "@/lib/uploads";

const PDF_MIME_TYPES = new Set([PDF_MIME_TYPE, "application/x-pdf"]);
// Types servers send for "some file" — a .pdf path then decides it
const GENERIC_BINARY_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/download",
  "application/force-download",
]);

function hasPdfPath(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/**
 * Whether a URL serves a PDF, from its response's content type, falling back to
 * a `.pdf` path when the type is missing or generic. A `.pdf` path served as
 * HTML (a viewer or landing page) isn't a PDF.
 */
export function isPdfContent({
  url,
  contentType,
}: {
  url: string;
  contentType: string | null;
}): boolean {
  const mime = contentType?.split(";")[0].trim().toLowerCase() ?? "";
  if (PDF_MIME_TYPES.has(mime)) return true;
  return (mime === "" || GENERIC_BINARY_TYPES.has(mime)) && hasPdfPath(url);
}

/**
 * Whether a page the browser extension captured is the browser's built-in PDF
 * viewer: its DOM is only an `<embed>` of the PDF, so the PDF itself must be
 * fetched instead.
 */
export function isCapturedPdfViewer({
  url,
  html,
}: {
  url: string;
  html: string;
}): boolean {
  return (
    hasPdfPath(url) || /<embed\b[^>]*type=["']application\/pdf["']/i.test(html)
  );
}

/**
 * A file name for a PDF fetched from `url`: the Content-Disposition filename,
 * else the URL's last path segment, else its host — always ending in `.pdf`.
 */
export function pdfFileNameFromUrl({
  url,
  contentDisposition,
}: {
  url: string;
  contentDisposition: string | null;
}): string {
  const fromHeader = contentDisposition?.match(
    /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i,
  )?.[1];
  let name = fromHeader ? safeDecode(fromHeader) : "";
  if (!name) {
    try {
      const parsed = new URL(url);
      const segment = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
      name = safeDecode(segment) || parsed.hostname;
    } catch {
      name = "document";
    }
  }
  name =
    name
      .replace(/[\\/]+/g, "-")
      .trim()
      .slice(0, 200) || "document";
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
