/**
 * Build small PDFs in tests (with mupdf itself) instead of committing binary
 * fixtures. A page is either text (a real text layer) or a scan (an image
 * with no text, like a photographed page).
 */
export type FixturePage = { text: string } | { scan: true };

export async function buildPdf(
  pages: FixturePage[],
  options: { password?: string } = {},
): Promise<Uint8Array> {
  // mupdf's save options are a comma/space-separated key=value list
  if (options.password && /[\s,=]/.test(options.password)) {
    throw new Error("buildPdf: the password can't contain spaces, commas or =");
  }
  const mupdf = await import("mupdf");
  const doc = new mupdf.PDFDocument();
  const font = doc.addSimpleFont(new mupdf.Font("Helvetica"));
  const a4: [number, number, number, number] = [0, 0, 595, 842];

  for (const page of pages) {
    if ("text" in page) {
      // PDF string literals escape backslashes and parentheses
      const escaped = page.text.replace(/[\\()]/g, (c) => `\\${c}`);
      const resources = doc.addObject({ Font: { F1: font } });
      const contents = `BT /F1 14 Tf 60 760 Td (${escaped}) Tj ET`;
      doc.insertPage(-1, doc.addPage(a4, 0, resources, contents));
    } else {
      const pixmap = new mupdf.Pixmap(
        mupdf.ColorSpace.DeviceRGB,
        [0, 0, 60, 85],
        false,
      );
      pixmap.clear(230);
      const image = doc.addImage(new mupdf.Image(pixmap));
      const resources = doc.addObject({ XObject: { Scan: image } });
      const contents = "q 595 0 0 842 0 0 cm /Scan Do Q";
      doc.insertPage(-1, doc.addPage(a4, 0, resources, contents));
    }
  }

  const saveOptions = options.password
    ? `encrypt=aes-256,user-password=${options.password},owner-password=${options.password}`
    : "";
  // Copy out of the WebAssembly heap, which later allocations can detach
  const bytes = doc.saveToBuffer(saveOptions).asUint8Array().slice();
  doc.destroy();
  return bytes;
}
