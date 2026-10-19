import { notFound } from "next/navigation";
import { BookReviewLayout } from "@/components/book/book-review-layout";
import { ReaderReview } from "@/components/book/reader-review";
import { SaveToAbodeCta } from "@/components/share/save-to-abode-cta";
import { bookReviewDescription, reviewText } from "@/lib/books/review";
import { isValidUrl } from "@/lib/url-utils";
import {
  getPublicBookReview,
  getSaveCtaState,
  loadPublicItem,
} from "../_lib/public-item";

type Props = {
  params: Promise<{ username: string; id: string }>;
};

// Loads the item and its review, or null when it isn't a viewable book
async function loadBookReview(params: Props["params"]) {
  const { username: rawUsername, id } = await params;
  const loaded = await loadPublicItem({ rawUsername, id });
  if (!loaded) return null;
  const bookReview = getPublicBookReview(loaded.item);
  return bookReview ? { ...loaded, ...bookReview } : null;
}

export async function generateMetadata({ params }: Props) {
  // Don't leak existence of books the current request can't view.
  const loaded = await loadBookReview(params);
  if (!loaded) return { title: "Not found" };

  const { user, book, review } = loaded;
  const title = book.title ?? "Untitled";
  const username = user.username ?? "";
  const hasOpinion = reviewText(review) !== null || review.rating !== null;
  return {
    title: hasOpinion
      ? `${title} | @${username}'s review | abode`
      : `${title} | @${username} | abode`,
    description: bookReviewDescription({ username, title, review }),
  };
}

/**
 * A reader's review of a book: the book up top (cover, title, authors), then
 * their rating, reading dates and review.
 */
export default async function BookReviewPage({ params }: Props) {
  const loaded = await loadBookReview(params);
  if (!loaded) notFound();
  const { user, viewerId, isOwner, book, review } = loaded;

  const saveCta = await getSaveCtaState({ user, viewerId, isOwner });
  const reader = {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 md:py-16">
      <BookReviewLayout book={book}>
        <ReaderReview reader={reader} review={review} />
        {saveCta && (
          <SaveToAbodeCta
            itemId={book.id}
            // Only http(s) links can be saved (by /save or after signup)
            sourceUrl={
              book.sourceUrl && isValidUrl(book.sourceUrl)
                ? book.sourceUrl
                : null
            }
            ownerUsername={user.username}
            isSignedIn={saveCta.isSignedIn}
            invitesOpen={saveCta.invitesOpen}
            placement="bottom"
          />
        )}
      </BookReviewLayout>
    </div>
  );
}
