import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listDesigns } from "./design-files";
import { ImageStudio } from "./image-studio";

export const metadata: Metadata = {
  title: "Image studio",
  robots: { index: false, follow: false },
};

/** Local-only tool for composing marketing images from the hero gallery */
export default async function ImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string; render?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { design, render } = await searchParams;
  const designs = await listDesigns();
  const active = designs.find((d) => d.slug === design) ?? designs[0] ?? null;
  return (
    <ImageStudio
      designs={designs.map((d) => ({ slug: d.slug, name: d.design.name }))}
      active={active}
      renderOnly={render === "1"}
    />
  );
}
