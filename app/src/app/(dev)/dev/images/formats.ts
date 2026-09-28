/** Overlay marking where a platform's own UI covers part of the image */
export type FormatGuide = {
  label: string;
  shape: "circle" | "rect";
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ImageFormat = {
  id: string;
  label: string;
  width: number;
  height: number;
  guide?: FormatGuide;
};

export const IMAGE_FORMATS = [
  {
    id: "x-header",
    label: "X header",
    width: 1500,
    height: 500,
    // X's desktop avatar: a ~133px circle over a 600px-wide header, inset 16px
    // and overlapping the header's bottom third
    guide: {
      label: "Avatar",
      shape: "circle",
      left: 40,
      top: 335,
      width: 333,
      height: 333,
    },
  },
  { id: "open-graph", label: "Open Graph", width: 1200, height: 630 },
  {
    id: "linkedin-banner",
    label: "LinkedIn banner",
    width: 1584,
    height: 396,
    // Profile photo sits over the lower-left of the banner
    guide: {
      label: "Profile photo",
      shape: "circle",
      left: 60,
      top: 230,
      width: 300,
      height: 300,
    },
  },
  { id: "square", label: "Square", width: 1080, height: 1080 },
  { id: "custom", label: "Custom", width: 1600, height: 900 },
] as const satisfies readonly ImageFormat[];

export type FormatId = (typeof IMAGE_FORMATS)[number]["id"];

export function getFormat(id: FormatId): ImageFormat {
  return IMAGE_FORMATS.find((f) => f.id === id) ?? IMAGE_FORMATS[0];
}

export function isFormatId(value: string): value is FormatId {
  return IMAGE_FORMATS.some((f) => f.id === value);
}
