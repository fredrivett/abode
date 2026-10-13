import { HighlightShareCard } from "@/components/article/highlight-share-card";
import { getOgHighlight, parseOgUsername } from "@/lib/og/data";
import {
  AbodeWordmark,
  fallbackOgImage,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogImageResponse,
} from "@/lib/og/render";

export const alt = "Highlight on abode";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; id: string; highlightId: string }>;
}) {
  const { username: rawUsername, id, highlightId } = await params;
  const username = parseOgUsername(rawUsername);
  const highlight = username
    ? await getOgHighlight({ username, itemId: id, highlightId })
    : null;

  if (!highlight) return fallbackOgImage();

  return ogImageResponse(
    <HighlightShareCard
      text={highlight.text}
      title={highlight.itemTitle}
      domain={highlight.domain}
      ownerUsername={highlight.ownerUsername}
      fonts={{ serif: "Hedvig", sans: "Geist" }}
      logo={<AbodeWordmark height={30} />}
    />,
  );
}
