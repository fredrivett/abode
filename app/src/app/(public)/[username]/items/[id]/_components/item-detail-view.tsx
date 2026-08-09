"use client";

import { ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { InstagramDetailView } from "@/components/instagram/instagram-detail-view";
import { ProductDetailView } from "@/components/product/product-detail-view";
import { TwitterDetailView } from "@/components/twitter/twitter-detail-view";
import { DateTime } from "@/components/ui/date-time";
import { VideoDetailView } from "@/components/video/video-detail-view";
import { getProxyImageUrl } from "@/lib/image-url";
import type { Item } from "@/lib/types/item";
import { isValidUrl } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import { ReadOnlyArticle, type ReadOnlyHighlight } from "./read-only-article";

type Owner = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type RoomContext = {
  slug: string;
  name: string;
  emoji: string | null;
};

// Client shape produced by the page. Compatible with the shared Item type
// for the fields the detail-view components read, but notes is always null.
type ClientItem = Pick<
  Item,
  | "id"
  | "kind"
  | "processingStatus"
  | "fileKey"
  | "coverFileKey"
  | "meta"
  | "sourceType"
  | "sourceUrl"
  | "title"
  | "description"
  | "tags"
  | "userTags"
  | "objects"
  | "colors"
  | "ocrText"
  | "captureDate"
  | "locations"
  | "articleDetails"
  | "twitterDetails"
  | "instagramDetails"
  | "videoDetails"
  | "productDetails"
> & { createdAt: string };

type Props = {
  item: ClientItem;
  owner: Owner;
  isOwner: boolean;
  highlights: ReadOnlyHighlight[];
  scrollToHighlightId: string | null;
  roomContext: RoomContext | null;
};

function ownerDisplayName(owner: Owner): string {
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  if (name) return name;
  return owner.username ? `@${owner.username}` : "abode";
}

/**
 * Standalone public detail view for a single shared item.
 *
 * Reuses the existing detail-view components for twitter/video/product/image,
 * and a read-only article renderer for articles (so signed-out viewers can see
 * shared highlights without hitting the owner-only highlights API).
 */
export function ItemDetailView({
  item,
  owner,
  highlights,
  scrollToHighlightId,
  roomContext,
}: Props) {
  const isArticle = item.kind === "article";
  const isTwitter = item.kind === "twitter";
  const isInstagram = item.kind === "instagram";
  const isVideo = item.kind === "video";
  const isProduct = item.kind === "product";

  const meta = item.meta || {};
  const articleTitle = meta.originalName as string | undefined;

  const imageFileKey = item.fileKey;
  const showImage =
    !isArticle &&
    !isTwitter &&
    !isInstagram &&
    !isVideo &&
    !isProduct &&
    !!imageFileKey;
  const imageUrl = showImage ? getProxyImageUrl(imageFileKey, "detail") : null;

  const ownerHref = owner.username ? `/@${owner.username}` : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 md:py-10">
      {/* Breadcrumb / owner context */}
      <nav className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
        {ownerHref ? (
          <Link href={ownerHref} className="hover:text-foreground">
            {ownerDisplayName(owner)}
          </Link>
        ) : (
          <span>{ownerDisplayName(owner)}</span>
        )}
        {roomContext && owner.username && (
          <>
            <span aria-hidden>/</span>
            <Link
              href={`/@${owner.username}/${roomContext.slug}`}
              className="hover:text-foreground"
            >
              {roomContext.emoji ? `${roomContext.emoji} ` : ""}
              {roomContext.name}
            </Link>
          </>
        )}
      </nav>

      <article className="flex flex-1 flex-col">
        {/* Title */}
        <h1 className="mb-2 font-semibold text-2xl text-foreground md:text-3xl">
          {item.title ?? "Untitled"}
        </h1>

        {/* Metadata line */}
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
          {item.kind && <span className="capitalize">{item.kind}</span>}
          <span aria-hidden>·</span>
          <DateTime date={item.createdAt} />
          {item.sourceUrl && isValidUrl(item.sourceUrl) && (
            <>
              <span aria-hidden>·</span>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
                Source
              </a>
            </>
          )}
        </div>

        {/* Body by kind */}
        {isArticle ? (
          item.articleDetails?.content ? (
            <div className="rounded-lg border border-border bg-background">
              <div className="p-6 md:p-8 lg:p-12">
                <div className="mx-auto w-full max-w-prose">
                  {articleTitle && (
                    <h2 className="mb-6 font-bold font-serif text-2xl text-foreground md:text-3xl lg:mb-8 lg:text-4xl">
                      {articleTitle}
                    </h2>
                  )}
                  <ReadOnlyArticle
                    content={item.articleDetails.content}
                    highlights={highlights}
                    scrollToHighlightId={scrollToHighlightId}
                    className="prose prose-sm md:prose-base lg:prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:font-serif prose-li:font-serif prose-p:font-serif"
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState label="No article content" />
          )
        ) : isTwitter ? (
          item.twitterDetails ? (
            <div className="rounded-lg border border-border bg-background">
              <TwitterDetailView
                twitterDetails={item.twitterDetails}
                sourceUrl={item.sourceUrl}
                className="py-8"
              />
            </div>
          ) : (
            <EmptyState label="No tweet content" />
          )
        ) : isInstagram ? (
          item.instagramDetails ? (
            <div className="rounded-lg border border-border bg-background">
              <InstagramDetailView
                instagramDetails={item.instagramDetails}
                sourceUrl={item.sourceUrl}
                className="py-8"
              />
            </div>
          ) : (
            <EmptyState label="No post content" />
          )
        ) : isVideo ? (
          item.videoDetails ? (
            <div className="rounded-lg border border-border bg-background">
              <VideoDetailView
                videoDetails={item.videoDetails}
                coverFileKey={item.coverFileKey}
                title={item.title}
                sourceUrl={item.sourceUrl}
                className="py-8"
              />
            </div>
          ) : (
            <EmptyState label="No video content" />
          )
        ) : isProduct ? (
          item.productDetails ? (
            <div className="rounded-lg border border-border bg-background">
              <ProductDetailView
                productDetails={item.productDetails}
                title={item.title}
                sourceUrl={item.sourceUrl}
                coverFileKey={item.coverFileKey}
                className="py-8"
              />
            </div>
          ) : (
            <EmptyState label="No product details" />
          )
        ) : imageUrl ? (
          <div className="overflow-hidden rounded-lg border border-border bg-gray-900">
            {/* biome-ignore lint/performance/noImgElement: proxy URL for user-uploaded content */}
            <img
              src={imageUrl}
              alt={item.title ?? "Item"}
              className="mx-auto max-h-[80vh] w-full object-contain"
            />
          </div>
        ) : (
          <EmptyState label="No preview available" />
        )}

        {/* Description */}
        {item.description && (
          <p className="mt-6 whitespace-pre-wrap text-foreground/80 text-sm md:text-base">
            {item.description}
          </p>
        )}
      </article>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-muted/30 p-12 text-center",
      )}
    >
      <FileText className="size-16 text-muted-foreground/50" />
      <p className="font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
