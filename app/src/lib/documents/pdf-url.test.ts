import { describe, expect, it } from "vitest";
import {
  isCapturedPdfViewer,
  isPdfContent,
  pdfFileNameFromUrl,
} from "./pdf-url";

describe("isPdfContent", () => {
  it.each([
    "application/pdf",
    "application/pdf; charset=binary",
    "Application/PDF",
    "application/x-pdf",
  ])("is a PDF when served as %s, whatever the path", (contentType) => {
    expect(
      isPdfContent({ url: "https://ex.com/download?id=7", contentType }),
    ).toBe(true);
  });

  it.each([null, "application/octet-stream", "binary/octet-stream"])(
    "trusts a .pdf path when the type is %j",
    (contentType) => {
      expect(
        isPdfContent({
          url: "https://ex.com/papers/Attention.PDF",
          contentType,
        }),
      ).toBe(true);
      expect(
        isPdfContent({ url: "https://ex.com/file.zip", contentType }),
      ).toBe(false);
    },
  );

  it("isn't a PDF when a .pdf path serves an HTML page", () => {
    expect(
      isPdfContent({
        url: "https://ex.com/report.pdf",
        contentType: "text/html; charset=utf-8",
      }),
    ).toBe(false);
  });

  it("ignores a .pdf query string", () => {
    expect(
      isPdfContent({
        url: "https://ex.com/view?file=a.pdf",
        contentType: null,
      }),
    ).toBe(false);
  });
});

describe("isCapturedPdfViewer", () => {
  it("recognises Chrome's PDF viewer, a lone embed of the PDF", () => {
    expect(
      isCapturedPdfViewer(
        '<html><head><title>a.pdf</title></head><body style="margin:0"><embed name="x" style="position:absolute" src="about:blank" type="application/pdf" internalid="1"></body></html>',
      ),
    ).toBe(true);
  });

  it("recognises Firefox's pdf.js viewer shell", () => {
    expect(
      isCapturedPdfViewer(
        '<html><body><div id="outerContainer"><div id="viewerContainer"><div id="viewer" class="pdfViewer"></div></div></div></body></html>',
      ),
    ).toBe(true);
  });

  it("keeps a real page that embeds a PDF among its content", () => {
    expect(
      isCapturedPdfViewer(
        '<html><body><h1>Annual report</h1><p>Read it below.</p><embed type="application/pdf" src="/r.pdf"></body></html>',
      ),
    ).toBe(false);
  });

  it("keeps an ordinary page", () => {
    expect(
      isCapturedPdfViewer(
        '<html><body><embed type="video/mp4"><p>Hello</p></body></html>',
      ),
    ).toBe(false);
  });
});

describe("pdfFileNameFromUrl", () => {
  it("prefers the Content-Disposition filename", () => {
    expect(
      pdfFileNameFromUrl({
        url: "https://ex.com/download?id=7",
        contentDisposition: 'attachment; filename="Annual Report 2025.pdf"',
      }),
    ).toBe("Annual Report 2025.pdf");
  });

  it("prefers the UTF-8 filename* over the ASCII fallback", () => {
    expect(
      pdfFileNameFromUrl({
        url: "https://ex.com/d",
        contentDisposition:
          "attachment; filename=\"Resume.pdf\"; filename*=UTF-8''R%C3%A9sum%C3%A9.pdf",
      }),
    ).toBe("Résumé.pdf");
  });

  it("decodes an RFC 5987 filename", () => {
    expect(
      pdfFileNameFromUrl({
        url: "https://ex.com/d",
        contentDisposition: "attachment; filename*=UTF-8''R%C3%A9sum%C3%A9.pdf",
      }),
    ).toBe("Résumé.pdf");
  });

  it("falls back to the decoded last path segment", () => {
    expect(
      pdfFileNameFromUrl({
        url: "https://arxiv.org/pdf/1706.03762v7.pdf",
        contentDisposition: null,
      }),
    ).toBe("1706.03762v7.pdf");
    expect(
      pdfFileNameFromUrl({
        url: "https://ex.com/docs/Lease%20agreement.pdf",
        contentDisposition: null,
      }),
    ).toBe("Lease agreement.pdf");
  });

  it("adds .pdf to a name without it, and uses the host for a bare URL", () => {
    expect(
      pdfFileNameFromUrl({
        url: "https://ex.com/download",
        contentDisposition: null,
      }),
    ).toBe("download.pdf");
    expect(
      pdfFileNameFromUrl({ url: "https://ex.com/", contentDisposition: null }),
    ).toBe("ex.com.pdf");
  });
});
