"use client";

import { Link2, Quote, Share } from "lucide-react";
import posthog from "posthog-js";
import {
  useCanNativeShare,
  useShareActions,
} from "@/components/share/share-actions";
import {
  SHARE_CARD_DOM_FONTS,
  ShareCardLogo,
  ShareCardPreview,
} from "@/components/share/share-card-preview";
import { ShareInvitesNote } from "@/components/share/share-invites-note";
import { Button } from "@/components/ui/button";
import {
  DialogOrDrawer,
  DialogOrDrawerBody,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
} from "@/components/ui/dialog-or-drawer";
import { Img } from "@/components/ui/img";
import { IsLoading } from "@/components/ui/is-loading";
import {
  type BookReview,
  bookReviewShareUrl,
  bookTitleLine,
  formatBookReview,
  reviewText,
} from "@/lib/books/review";
import {
  BOOK_REVIEW_CARD_SIZE,
  BookReviewShareCard,
  type BookReviewShareCardProps,
} from "./book-review-share-card";

export type ShareableBook = {
  id: string;
  title: string | null;
  authors: string[];
  /** Image URL for the cover (e.g. the image proxy's), or null for none */
  coverUrl: string | null;
  /** Cover width/height (see getBookCoverRatio) */
  coverRatio?: number;
  coverColor?: string | null;
};

type ShareBookReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: ShareableBook;
  /** The reading data as it stands, including any unsaved review edits */
  review: BookReview;
  username: string;
  /** Whether the item already has link sharing on */
  isShared: boolean;
  /** Called once sharing the review has turned on the item's link sharing */
  onShared: () => void;
};

/** The review's share card, scaled down to the available width. */
export function BookReviewCardPreview({
  coverUrl,
  ...props
}: Omit<BookReviewShareCardProps, "fonts" | "logo" | "renderCover"> & {
  coverUrl: string | null;
}) {
  return (
    <ShareCardPreview size={BOOK_REVIEW_CARD_SIZE}>
      <BookReviewShareCard
        {...props}
        renderCover={
          coverUrl
            ? ({ width, height }) => (
                <Img
                  src={coverUrl}
                  alt=""
                  style={{ width, height, objectFit: "cover" }}
                />
              )
            : null
        }
        fonts={SHARE_CARD_DOM_FONTS}
        logo={<ShareCardLogo />}
      />
    </ShareCardPreview>
  );
}

/**
 * Preview-and-share for a book review: shows the card the link unfurls to, and
 * copies the link (or the review as text) or hands it to the native share
 * sheet. Sharing turns on the book's link sharing if it isn't already on, so
 * the dialog says so before anything is copied.
 */
export function ShareBookReviewDialog({
  open,
  onOpenChange,
  book,
  review,
  username,
  isShared,
  onShared,
}: ShareBookReviewDialogProps) {
  const canNativeShare = useCanNativeShare();
  const { busy, pending, methodIcon, copy, nativeShare } = useShareActions<
    "copy_link" | "copy_review"
  >({
    itemId: book.id,
    isShared,
    onShared,
    source: "book_review",
    sharingErrorMessage: "Couldn't turn on sharing for this book",
    onSuccess: (method) =>
      posthog.capture("book_review_shared", {
        item_id: book.id,
        method,
        has_review: reviewText(review) !== null,
        has_rating: review.rating !== null,
      }),
  });

  const title = book.title ?? "Untitled";
  const url = bookReviewShareUrl({ username, itemId: book.id });
  const hasReview = reviewText(review) !== null;
  const hasOpinion = hasReview || review.rating !== null;

  return (
    <DialogOrDrawer open={open} onOpenChange={onOpenChange}>
      <DialogOrDrawerContent
        className="sm:max-w-xl"
        // Radix focuses the first button on open, so Copy link would open
        // wearing its focus ring; focus the dialog itself instead, so screen
        // readers land in it and Tab moves to the first action
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus();
        }}
      >
        <DialogOrDrawerHeader>
          <DialogOrDrawerTitle>
            {hasOpinion ? "Share review" : "Share book"}
          </DialogOrDrawerTitle>
          <DialogOrDrawerDescription>
            This is how your link will look when you share it.
          </DialogOrDrawerDescription>
        </DialogOrDrawerHeader>

        <DialogOrDrawerBody className="space-y-5">
          <BookReviewCardPreview
            title={title}
            authors={book.authors}
            review={review}
            ownerUsername={username}
            coverRatio={book.coverRatio}
            coverColor={book.coverColor}
            coverUrl={book.coverUrl}
          />

          <p className="text-muted-foreground text-xs">
            {!hasOpinion &&
              "Add a rating or a review to say what you thought. "}
            {isShared
              ? "Anyone with the link can see this book and your reading details."
              : "Sharing turns on link sharing for this book, so anyone with the link can see it and your reading details."}
          </p>

          <ShareInvitesNote enabled={open} />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              // The light theme's secondary is near-white; a firmer grey keeps
              // the main action standing out from the outlined ones
              className="bg-gray-200 hover:bg-gray-300 sm:flex-1 dark:bg-secondary dark:hover:bg-secondary/80"
              disabled={busy}
              onClick={() => void copy("copy_link", url, "Link copied")}
            >
              {pending === "copy_link" ? (
                <IsLoading label="Sharing" />
              ) : (
                <>
                  {methodIcon("copy_link", <Link2 />)}
                  Copy link
                </>
              )}
            </Button>
            {hasReview && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void copy(
                    "copy_review",
                    formatBookReview({
                      title,
                      authors: book.authors,
                      review,
                      url,
                    }),
                    "Review copied",
                  )
                }
              >
                {methodIcon("copy_review", <Quote />)}
                Copy review
              </Button>
            )}
            {canNativeShare && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  // The link goes in `url` only; repeating it in `text` makes
                  // some targets show it twice
                  void nativeShare({
                    title: bookTitleLine({ title, authors: book.authors }),
                    text: formatBookReview({
                      title,
                      authors: book.authors,
                      review,
                    }),
                    url,
                  })
                }
              >
                <Share />
                Share…
              </Button>
            )}
          </div>
        </DialogOrDrawerBody>
      </DialogOrDrawerContent>
    </DialogOrDrawer>
  );
}
