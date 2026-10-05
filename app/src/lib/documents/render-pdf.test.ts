// @vitest-environment node
import { buildPdf } from "@app/test/pdf-fixtures";
import { describe, expect, it } from "vitest";
import { ProcessingFailure } from "@/lib/items/processing-error";
import { MAX_PDF_PAGES, openPdf } from "./render-pdf";

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

async function failureReason(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ProcessingFailure);
  return (error as ProcessingFailure).reason;
}

describe("openPdf", () => {
  it("renders each page to a JPEG with its embedded text", async () => {
    const pdf = await openPdf(
      await buildPdf([
        { text: "Invoice from Acme Ltd, total due 42 GBP by 1 March" },
        { text: "Page two: terms and conditions of the order apply" },
      ]),
    );
    try {
      expect(pdf.pageCount).toBe(2);
      const first = pdf.renderPage(0);
      expect([...first.jpeg.subarray(0, 3)]).toEqual(JPEG_MAGIC);
      // A4 fitted to a 2000px longest side
      expect(first.height).toBe(2000);
      expect(first.width).toBe(1414);
      expect(first.text).toBe(
        "Invoice from Acme Ltd, total due 42 GBP by 1 March",
      );
      expect(pdf.renderPage(1).text).toContain("terms and conditions");
    } finally {
      pdf.close();
    }
  });

  it("leaves a scanned page's text null so it's OCR'd", async () => {
    const pdf = await openPdf(
      await buildPdf([
        { scan: true },
        { text: "A typed cover letter with plenty of words on it" },
      ]),
    );
    try {
      const scan = pdf.renderPage(0);
      expect(scan.text).toBeNull();
      expect(scan.jpeg.length).toBeGreaterThan(0);
      expect(pdf.renderPage(1).text).not.toBeNull();
    } finally {
      pdf.close();
    }
  });

  it("reports a page that can't be rendered as unreadable, not a crash", async () => {
    const pdf = await openPdf(
      await buildPdf([{ text: "One page only, nothing more here" }]),
    );
    try {
      let error: unknown;
      try {
        pdf.renderPage(5);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ProcessingFailure);
      expect((error as ProcessingFailure).reason).toBe("file_unreadable");
    } finally {
      pdf.close();
    }
  });

  it("rejects a file that isn't a PDF as unreadable", async () => {
    const bytes = new TextEncoder().encode("<html>not a pdf</html>");
    expect(await failureReason(openPdf(bytes))).toBe("file_unreadable");
  });

  it("rejects a damaged PDF as unreadable", async () => {
    const bytes = new TextEncoder().encode(
      "%PDF-1.7\n garbage with no objects",
    );
    expect(await failureReason(openPdf(bytes))).toBe("file_unreadable");
  });

  it("rejects a password-protected PDF as unreadable", async () => {
    const bytes = await buildPdf(
      [{ text: "Top secret quarterly figures here" }],
      {
        password: "hunter2",
      },
    );
    expect(await failureReason(openPdf(bytes))).toBe("file_unreadable");
  });

  it("rejects a PDF past the page safety ceiling", async () => {
    const pages = Array.from({ length: MAX_PDF_PAGES + 1 }, () => ({
      text: "x",
    }));
    expect(await failureReason(openPdf(await buildPdf(pages)))).toBe(
      "document_too_long",
    );
  }, 30_000);
});
