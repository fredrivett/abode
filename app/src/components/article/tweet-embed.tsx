"use client";

import { Tweet } from "react-tweet";

type TweetEmbedProps = {
  tweetId: string;
};

export function TweetEmbed({ tweetId }: TweetEmbedProps) {
  return (
    <div className="not-prose my-4 flex justify-center">
      <Tweet id={tweetId} />
    </div>
  );
}
