import type { TweetReplyContext as TweetReplyContextData } from "./types";

type TweetReplyContextProps = {
  inReplyTo: TweetReplyContextData;
  /** The saved tweet's author — a reply to themselves continues their thread */
  authorUsername: string;
};

/**
 * What a reply is replying to: the post above it, linking back to X. When the
 * author replies to themselves the tweet is part of their thread. The parent's
 * text is absent when X no longer serves it (e.g. it was deleted).
 */
export function TweetReplyContext({
  inReplyTo,
  authorUsername,
}: TweetReplyContextProps) {
  const href = `https://x.com/${inReplyTo.authorUsername}/status/${inReplyTo.tweetId}`;
  const isThread =
    inReplyTo.authorUsername.toLowerCase() === authorUsername.toLowerCase();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block space-y-1 border-gray-200 border-l-2 py-0.5 pl-3 transition-colors hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
    >
      <p className="text-gray-500 text-sm dark:text-gray-400">
        {isThread ? "Continues a thread by" : "Replying to"}{" "}
        <span className="text-blue-500">@{inReplyTo.authorUsername}</span>
      </p>
      {inReplyTo.text && (
        <p className="line-clamp-3 whitespace-pre-wrap text-gray-600 text-sm dark:text-gray-300">
          {inReplyTo.text}
        </p>
      )}
    </a>
  );
}
