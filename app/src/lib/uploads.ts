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
