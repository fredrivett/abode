import { APP_NAME } from "@/lib/app";
import { GITHUB_URL } from "@/lib/github";

/**
 * Schema.org graph for the homepage: who publishes the site (Organization)
 * and what the site is (WebSite). Helps search engines and AI answers resolve
 * "abode" to this product rather than the dictionary word.
 */
export function homepageStructuredData({
  baseUrl,
  description,
}: {
  baseUrl: string;
  description: string;
}) {
  const organizationId = `${baseUrl}/#organization`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: APP_NAME,
        url: `${baseUrl}/`,
        logo: `${baseUrl}/icons/icon-512.png`,
        sameAs: [GITHUB_URL],
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        name: APP_NAME,
        url: `${baseUrl}/`,
        description,
        publisher: { "@id": organizationId },
      },
    ],
  };
}

/**
 * JSON for an inline `<script type="application/ld+json">`. Escapes `<` so a
 * value containing `</script>` can't close the tag early.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
