export const MAX_IMAGE_UPLOAD_MB = 15;
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_LABEL = `${MAX_IMAGE_UPLOAD_MB}MB`;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const allowedImageMimeTypes = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

export const PDF_MIME_TYPE = "application/pdf";

/**
 * Largest PDF we accept. Below the `items` bucket's 50MB limit; every page is
 * rendered to an image, so this also bounds the import's time and memory.
 */
export const MAX_PDF_UPLOAD_MB = 25;
export const MAX_PDF_UPLOAD_BYTES = MAX_PDF_UPLOAD_MB * 1024 * 1024;
export const MAX_PDF_UPLOAD_LABEL = `${MAX_PDF_UPLOAD_MB}MB`;

/** Every type the upload pickers accept, for an `<input accept>` */
export const UPLOAD_ACCEPT = [...ALLOWED_IMAGE_MIME_TYPES, PDF_MIME_TYPE].join(
  ",",
);

export type UploadKind = "image" | "pdf";

export type UploadValidation =
  | { ok: true; kind: UploadKind }
  /** `kind` is set when the type was fine but the file is too large */
  | { ok: false; error: string; kind?: UploadKind };

/**
 * Whether a file is a PDF. Some browsers/OSes report an empty type for a
 * dropped file, so the extension is the fallback.
 */
function isPdf(file: { name: string; type: string }): boolean {
  if (file.type === PDF_MIME_TYPE) return true;
  return file.type === "" && file.name.toLowerCase().endsWith(".pdf");
}

/** Check a file against the upload type and size limits before uploading it */
export function validateUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): UploadValidation {
  if (isPdf(file)) {
    if (file.size > MAX_PDF_UPLOAD_BYTES) {
      return {
        ok: false,
        kind: "pdf",
        error: `PDF is too large. Max size is ${MAX_PDF_UPLOAD_LABEL}.`,
      };
    }
    return { ok: true, kind: "pdf" };
  }

  if (!allowedImageMimeTypes.has(file.type)) {
    return {
      ok: false,
      error:
        "Unsupported file type. Choose a PDF or a jpg, png, gif, or webp image.",
    };
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      kind: "image",
      error: `File is too large. Max size is ${MAX_IMAGE_UPLOAD_LABEL}.`,
    };
  }
  return { ok: true, kind: "image" };
}
