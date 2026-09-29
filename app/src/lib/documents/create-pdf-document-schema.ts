import { z } from "zod";
import { MAX_PDF_UPLOAD_BYTES } from "@/lib/uploads";

/** Body of `POST /api/v1/items/documents/pdf`: a PDF the client has uploaded */
export const createPdfDocumentSchema = z.object({
  /** Storage key of the uploaded PDF, in the user's folder */
  fileKey: z
    .string()
    .min(1)
    .max(512)
    .refine((key) => key.toLowerCase().endsWith(".pdf"), "Must be a .pdf key"),
  originalName: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_PDF_UPLOAD_BYTES),
});

export type CreatePdfDocumentBody = z.infer<typeof createPdfDocumentSchema>;

/** A starting title from the file name, shown until the document is described */
export function titleFromFileName(name: string): string {
  const title = name
    .replace(/\.pdf$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title || "Untitled PDF";
}
