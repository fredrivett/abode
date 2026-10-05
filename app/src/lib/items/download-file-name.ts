/**
 * File name for an item download. A PDF document keeps the name it was
 * uploaded with (or its title, with `.pdf` added); anything else keeps the
 * previous behaviour of downloading under its display name.
 */
export function downloadFileName({
  name,
  originalName,
  isPdf,
}: {
  name: string;
  originalName: unknown;
  isPdf: boolean;
}): string {
  if (!isPdf) return name || "download";
  if (typeof originalName === "string" && /\.pdf$/i.test(originalName.trim())) {
    return withoutPathSeparators(originalName) || "document.pdf";
  }
  return `${withoutPathSeparators(name) || "document"}.pdf`;
}

// Path separators would make some browsers drop or mangle the name
const withoutPathSeparators = (value: string) =>
  value.replace(/[\\/]+/g, "-").trim();
