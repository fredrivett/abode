import { BookReviewShareCard } from "@/components/book/book-review-share-card";
import { getOgBookReview, parseOgUsername } from "@/lib/og/data";
import {
  AbodeWordmark,
  coverImageUrl,
  fallbackOgImage,
  imageDataUri,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogImageResponse,
} from "@/lib/og/render";

export const alt = "Book review on abode";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username: rawUsername, id } = await params;
  const username = parseOgUsername(rawUsername);
  const book = username
    ? await getOgBookReview({ username, itemId: id })
    : null;

  if (!book) return fallbackOgImage();

  // The card draws the cover inside an SVG, which can't fetch it itself
  const cover = await imageDataUri(coverImageUrl(book.coverFileKey, "grid"));
  // Called, not rendered as a component: satori only preloads the SVG cover
  // image it can reach through plain elements
  return ogImageResponse(
    BookReviewShareCard({
      title: book.title,
      authors: book.authors,
      review: book.review,
      ownerUsername: book.ownerUsername,
      coverRatio: book.coverRatio,
      coverColor: book.coverColor,
      coverHref: cover,
      fonts: { serif: "Hedvig", sans: "Geist" },
      logo: <AbodeWordmark height={30} />,
    }),
  );
}
