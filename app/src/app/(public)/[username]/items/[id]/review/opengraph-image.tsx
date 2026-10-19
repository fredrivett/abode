import { BookReviewShareCard } from "@/components/book/book-review-share-card";
import { getOgBookReview, parseOgUsername } from "@/lib/og/data";
import {
  AbodeWordmark,
  coverImageUrl,
  fallbackOgImage,
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

  const cover = coverImageUrl(book.coverFileKey, "grid");
  return ogImageResponse(
    <BookReviewShareCard
      title={book.title}
      authors={book.authors}
      review={book.review}
      ownerUsername={book.ownerUsername}
      coverRatio={book.coverRatio}
      coverColor={book.coverColor}
      renderCover={
        cover
          ? ({ width, height }) => (
              // biome-ignore lint/performance/noImgElement: next/og (satori) renders raw <img>; next/image is unavailable here
              <img
                src={cover}
                width={width}
                height={height}
                alt=""
                style={{ width, height, objectFit: "cover" }}
              />
            )
          : null
      }
      fonts={{ serif: "Hedvig", sans: "Geist" }}
      logo={<AbodeWordmark height={30} />}
    />,
  );
}
