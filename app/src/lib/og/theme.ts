// The app is intentionally monochrome (see the grayscale theme in
// globals.css). Keep the OG palette on-brand: a near-black card, off-white
// text, muted grey for secondary lines. Lives apart from render.tsx (which
// reads fonts off disk) so client components can share it.
export const OG_COLORS = {
  bg: "#171717",
  surface: "#1f1f1f",
  fg: "#fafafa",
  muted: "#8f8f8f",
  border: "rgba(255,255,255,0.10)",
} as const;
