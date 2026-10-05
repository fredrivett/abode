import { Img } from "@/components/ui/img";
import { twitterImageSrc } from "@/lib/twitter/image-src";
import { getHostname } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import type { TwitterDetails } from "./types";

type TweetLinkCardProps = {
  card: NonNullable<TwitterDetails["card"]>;
};

/**
 * A tweet's card: a link preview, or an X Article's cover, title and opening
 * lines. X only shares an Article's first ~200 characters, so the card links
 * through to read the rest on X.
 */
export function TweetLinkCard({ card }: TweetLinkCardProps) {
  const isArticle = card.type === "article";
  const imageSrc = twitterImageSrc(card.imageFileKey, card.imageUrl, "detail");

  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-xl border border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
    >
      {imageSrc && (
        <Img
          src={imageSrc}
          alt={
            card.title
              ? `${isArticle ? "Article cover" : "Link preview"}: ${card.title}`
              : "Link preview"
          }
          className={cn(
            "w-full object-cover",
            // X Article covers are 5:2; link-card images ~1.91:1
            isArticle ? "aspect-[5/2]" : "aspect-video",
          )}
          loading="lazy"
        />
      )}
      <div className="space-y-0.5 p-3">
        <p className="text-gray-500 text-sm dark:text-gray-400">
          {isArticle ? "Article on X" : getHostname(card.url)}
        </p>
        <p
          className={cn(
            "font-medium text-gray-900 dark:text-gray-100",
            isArticle && "text-lg",
          )}
        >
          {card.title}
        </p>
        {card.description && (
          <p
            className={cn(
              "text-gray-600 text-sm dark:text-gray-300",
              isArticle ? "line-clamp-4" : "line-clamp-2",
            )}
          >
            {card.description}
          </p>
        )}
        {isArticle && (
          <p className="pt-1 font-medium text-blue-500 text-sm">
            Read the full Article on X
          </p>
        )}
      </div>
    </a>
  );
}
