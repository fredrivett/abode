import { notFound } from "next/navigation";
import { ItemDetailView } from "./_components/item-detail-view";
import {
  getSaveCtaState,
  getVisibleHighlights,
  loadPublicItem,
  toClientItem,
} from "./_lib/public-item";

type Props = {
  params: Promise<{ username: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function generateMetadata({ params }: Props) {
  const { username: rawUsername, id } = await params;
  // Don't leak existence of items the current request can't view.
  const loaded = await loadPublicItem({ rawUsername, id });
  if (!loaded) return { title: "Not found" };

  const { user, item } = loaded;
  return {
    title: `${item.title ?? "Item"} | @${user.username} | abode`,
    description: item.description ?? undefined,
  };
}

export default async function ItemPage({ params, searchParams }: Props) {
  const { username: rawUsername, id } = await params;
  const resolvedSearchParams = await searchParams;

  const loaded = await loadPublicItem({ rawUsername, id });
  if (!loaded) notFound();
  const { user, item, viewerId, isOwner } = loaded;

  // Presentation-only ?room= context. Validate that the room exists, is
  // public, and actually contains this item. Never used in the access
  // decision above.
  const roomSlug = firstParam(resolvedSearchParams.room);
  const roomContext =
    roomSlug !== null
      ? (() => {
          const match = item.roomItems.find(
            (ri) =>
              ri.room.visibility === "public" &&
              ri.room.slug !== null &&
              ri.room.slug.toLowerCase() === roomSlug.toLowerCase(),
          );
          if (!match || match.room.slug === null) return null;
          return {
            slug: match.room.slug,
            name: match.room.name,
            emoji: match.room.emoji,
          };
        })()
      : null;

  // ?highlight= passes through to the client so the article can scroll to /
  // flash the highlight.
  const highlightId = firstParam(resolvedSearchParams.highlight);

  const [highlights, saveCta] = await Promise.all([
    getVisibleHighlights({ item, viewerId }),
    getSaveCtaState({ user, viewerId, isOwner }),
  ]);

  return (
    <ItemDetailView
      item={toClientItem(item, { isOwner })}
      owner={{
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      }}
      isOwner={isOwner}
      saveCta={saveCta}
      highlights={highlights}
      scrollToHighlightId={highlightId}
      roomContext={roomContext}
    />
  );
}
