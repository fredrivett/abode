import { describe, expect, it } from "vitest";
import { downloadFileName } from "./download-file-name";

describe("downloadFileName", () => {
  it("keeps an uploaded PDF's original file name", () => {
    expect(
      downloadFileName({
        name: "Northside Energy bill, Q1 2026",
        originalName: "Q1-bill.pdf",
        isPdf: true,
      }),
    ).toBe("Q1-bill.pdf");
  });

  it("names a PDF after its title when the original name is unusable", () => {
    for (const originalName of [undefined, 42, "scan"]) {
      expect(
        downloadFileName({
          name: "Lease agreement",
          originalName,
          isPdf: true,
        }),
      ).toBe("Lease agreement.pdf");
    }
  });

  it("strips path separators from a title-derived name", () => {
    expect(
      downloadFileName({
        name: "Bills / 2026",
        originalName: null,
        isPdf: true,
      }),
    ).toBe("Bills - 2026.pdf");
  });

  it("falls back to 'document.pdf' for an untitled PDF", () => {
    expect(
      downloadFileName({ name: "", originalName: null, isPdf: true }),
    ).toBe("document.pdf");
  });

  it("downloads other items under their display name, as before", () => {
    expect(
      downloadFileName({
        name: "Sunset",
        originalName: "IMG_1.jpg",
        isPdf: false,
      }),
    ).toBe("Sunset");
    expect(
      downloadFileName({ name: "", originalName: null, isPdf: false }),
    ).toBe("download");
  });
});
