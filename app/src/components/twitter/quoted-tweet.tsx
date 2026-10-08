import { Img } from "@/components/ui/img";
import { tweetImageAlt } from "@/lib/twitter/image-alt";
import { cn } from "@/lib/utils";
import type { QuotedTweet as QuotedTweetData } from "./types";

const MAX_STILLS = 4;

/**
 * The tweet a saved tweet quotes, as X shows it: a bordered mini-tweet linking
 * to the original. Its images are hotlinked stills (a video shows its poster).
 */
export function QuotedTweet({ quote }: { quote: QuotedTweetData }) {
  const href = `https://x.com/${quote.authorUsername}/status/${quote.tweetId}`;
  const stills = (quote.media ?? [])
    .map((item) => (item.type === "photo" ? item.url : item.posterUrl))
    .filter((url): url is string => !!url)
    .slice(0, MAX_STILLS);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block space-y-2 rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
    >
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {quote.authorAvatarUrl && (
          // Decorative: the author name renders as visible text alongside
          <Img
            src={quote.authorAvatarUrl}
            alt=""
            className="size-5 shrink-0 rounded-full"
            loading="lazy"
          />
        )}
        <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
          {quote.authorName ?? `@${quote.authorUsername}`}
        </span>
        {quote.authorName && (
          <span className="truncate text-gray-500 dark:text-gray-400">
            @{quote.authorUsername}
          </span>
        )}
      </div>
      {quote.text && (
        <p className="line-clamp-6 whitespace-pre-wrap text-gray-900 text-sm dark:text-gray-100">
          {quote.text}
          {quote.isTruncated && "…"}
        </p>
      )}
      {stills.length > 0 && (
        <div
          className={cn(
            "grid gap-1 overflow-hidden rounded-lg",
            stills.length > 1 && "grid-cols-2",
          )}
        >
          {stills.map((src, index) => (
            <Img
              // biome-ignore lint/suspicious/noArrayIndexKey: src can repeat; static, never-reordered list
              key={`${src}-${index}`}
              src={src}
              alt={tweetImageAlt(
                { name: quote.authorName, username: quote.authorUsername },
                { index, total: stills.length },
              )}
              className="aspect-video w-full object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}
    </a>
  );
}
