import { serializeJsonLd } from "@/lib/seo/structured-data";

/** Renders Schema.org structured data as an inline JSON-LD script */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: server-built JSON, `<` escaped by serializeJsonLd
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
