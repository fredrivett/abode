import { notFound } from "next/navigation";
import { normalizeHighlightText, truncateAtWord } from "@/lib/highlights/share";
import { ItemDetailView } from "../../_components/item-detail-view";
import {
  getSaveCtaState,
  getSharedHighlight,
  getVisibleHighlights,
  loadPublicItem,
  toClientItem,
} from "../../_lib/public-item";

type Props = {
  params: Promise<{ username: string; id: string; highlightId: string }>;
};

// Loads the item + highlight, or null when either isn't viewable
async function loadSharedHighlight(params: Props["params"]) {
  const { username: rawUsername, id, highlightId } = await params;
  const loaded = await loadPublicItem({ rawUsername, id });
  if (!loaded) return null;
  const highlight = await getSharedHighlight({
    item: loaded.item,
    highlightId,
  });
  return highlight ? { ...loaded, highlight } : null;
}

export async function generateMetadata({ params }: Props) {
  // Don't leak existence of highlights the current request can't view.
  const loaded = await loadSharedHighlight(params);
  if (!loaded) return { title: "Not found" };

  const { user, item, highlight } = loaded;
  const quote = truncateAtWord(normalizeHighlightText(highlight.text), 90);
  const source = item.title ?? "an article";
  return {
    title: `“${quote}” | @${user.username} | abode`,
    description: `Highlighted by @${user.username} from ${source}`,
  };
}

/**
 * A single shared highlight: the quote up top, then the article with the
 * highlight marked so readers can see it in context.
 */
export default async function SharedHighlightPage({ params }: Props) {
  const loaded = await loadSharedHighlight(params);
  if (!loaded) notFound();
  const { user, item, viewerId, isOwner, highlight } = loaded;

  // The link shares this highlight; the rest only show if the owner opted in
  const visible = await getVisibleHighlights({ item, viewerId });
  const highlights = visible.some((h) => h.id === highlight.id)
    ? visible
    : [highlight];

  return (
    <ItemDetailView
      item={toClientItem(item)}
      owner={{
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      }}
      isOwner={isOwner}
      saveCta={await getSaveCtaState({ user, viewerId, isOwner })}
      highlights={highlights}
      featuredHighlight={highlight}
      scrollToHighlightId={null}
      roomContext={null}
    />
  );
}
