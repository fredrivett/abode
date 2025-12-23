"use client";

import { Tweet } from "react-tweet";

type TweetEmbedProps = {
  tweetId: string;
};

export function TweetEmbed({ tweetId }: TweetEmbedProps) {
  return (
    <div className="my-4 flex justify-center not-prose">
      <Tweet id={tweetId} />
    </div>
  );
}
