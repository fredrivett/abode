import { describe, expect, it } from "vitest";
import { usableTextLayer } from "./pdf-text";

describe("usableTextLayer", () => {
  it("returns a text page's text, with layout whitespace collapsed", () => {
    expect(
      usableTextLayer(
        "  Invoice   from Acme Ltd  \n\n\n\n  Total due:\t£42.00 by 1 March  \n",
      ),
    ).toBe("Invoice from Acme Ltd\n\nTotal due: £42.00 by 1 March");
  });

  it("treats a page with no text layer as scanned", () => {
    expect(usableTextLayer("")).toBeNull();
    expect(usableTextLayer("  \n\n ")).toBeNull();
  });

  it("treats a scan with only a page number or stamp as scanned", () => {
    expect(usableTextLayer("3")).toBeNull();
    expect(usableTextLayer("Page 3 of 12 — COPY")).toBeNull();
  });

  it("counts letters in any script, not just ASCII", () => {
    expect(
      usableTextLayer(
        "請求書 株式会社アクメ 合計金額 四十二円 支払期限 三月一日",
      ),
    ).not.toBeNull();
  });

  it("distrusts a garbled layer from a font without a Unicode mapping", () => {
    const garbled = `Invoice ${"\uFFFD".repeat(40)} total ${"\uE001".repeat(20)}`;
    expect(usableTextLayer(garbled)).toBeNull();
  });

  it("tolerates a few unmappable glyphs in otherwise good text", () => {
    const text = `Quarterly statement for account 12345678 \uFFFD balance carried forward`;
    expect(usableTextLayer(text)).toBe(text);
  });
});
