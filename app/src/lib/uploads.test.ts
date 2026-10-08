import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  validateUploadFile,
} from "./uploads";

const file = (name: string, type: string, size = 1024) => ({
  name,
  type,
  size,
});

describe("validateUploadFile", () => {
  it.each(["image/jpeg", "image/png", "image/gif", "image/webp"])(
    "accepts a %s image",
    (type) => {
      expect(validateUploadFile(file("photo", type))).toEqual({
        ok: true,
        kind: "image",
      });
    },
  );

  it("accepts a PDF", () => {
    expect(validateUploadFile(file("bill.pdf", "application/pdf"))).toEqual({
      ok: true,
      kind: "pdf",
    });
  });

  it("recognises a PDF by extension when the browser reports no type", () => {
    expect(validateUploadFile(file("Bill.PDF", ""))).toEqual({
      ok: true,
      kind: "pdf",
    });
  });

  it("doesn't trust a .pdf name over a conflicting type", () => {
    expect(validateUploadFile(file("evil.pdf", "text/html")).ok).toBe(false);
  });

  it.each(["text/plain", "video/mp4", "application/zip", ""])(
    "rejects %j with a message naming what's allowed",
    (type) => {
      const result = validateUploadFile(file("thing.bin", type));
      expect(result).toEqual({
        ok: false,
        error:
          "Unsupported file type. Choose a PDF or a jpg, png, gif, or webp image.",
      });
    },
  );

  it("allows a PDF up to 25MB and rejects anything larger", () => {
    expect(MAX_PDF_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(
      validateUploadFile(file("a.pdf", "application/pdf", MAX_PDF_UPLOAD_BYTES))
        .ok,
    ).toBe(true);
    expect(
      validateUploadFile(
        file("a.pdf", "application/pdf", MAX_PDF_UPLOAD_BYTES + 1),
      ),
    ).toEqual({
      ok: false,
      kind: "pdf",
      error: "PDF is too large. Max size is 25MB.",
    });
  });

  it("keeps the 15MB image limit", () => {
    expect(
      validateUploadFile(file("a.png", "image/png", MAX_IMAGE_UPLOAD_BYTES)).ok,
    ).toBe(true);
    expect(
      validateUploadFile(
        file("a.png", "image/png", MAX_IMAGE_UPLOAD_BYTES + 1),
      ),
    ).toEqual({
      ok: false,
      kind: "image",
      error: "File is too large. Max size is 15MB.",
    });
  });
});

describe("UPLOAD_ACCEPT", () => {
  it("lets the file pickers choose images and PDFs", () => {
    expect(UPLOAD_ACCEPT.split(",")).toEqual([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ]);
  });
});
