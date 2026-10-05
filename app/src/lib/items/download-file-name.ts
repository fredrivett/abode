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
    return originalName.trim();
  }
  // Path separators would make some browsers drop or mangle the name
  const base = name.replace(/[\\/]+/g, "-").trim() || "document";
  return `${base}.pdf`;
}
