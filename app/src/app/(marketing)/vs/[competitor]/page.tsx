import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COMPARISONS, getComparison } from "@/lib/comparisons";
import { ComparisonPage } from "../_components/comparison-page";

type Props = { params: Promise<{ competitor: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARISONS.map(({ slug }) => ({ competitor: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const comparison = getComparison((await params).competitor);
  if (!comparison) return {};

  const title = `abode vs ${comparison.name} — an open-source ${comparison.name} alternative`;
  const path = `/vs/${comparison.slug}`;

  return {
    title,
    description: comparison.description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: comparison.description,
      url: path,
      siteName: "abode",
      type: "website",
    },
  };
}

export default async function CompetitorPage({ params }: Props) {
  const comparison = getComparison((await params).competitor);
  if (!comparison) notFound();

  return <ComparisonPage comparison={comparison} />;
}
