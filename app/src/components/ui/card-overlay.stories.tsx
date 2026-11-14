import type { Meta, StoryObj } from "@storybook/react";
import { Files } from "lucide-react";
import type { ReactNode } from "react";
import { ArticleCard } from "@/components/article/article-card";
import { ArticleReadStatusBadge } from "@/components/article/article-read-status-badge";
import { BookCover3D } from "@/components/book/book-cover-3d";
import { BookReadingStatusBadge } from "@/components/book/book-reading-status-icon";
import { InstagramCard } from "@/components/instagram/instagram-card";
import { TwitterCard } from "@/components/twitter/twitter-card";
import { VideoCard } from "@/components/video/video-card";
import { BOOK_TILE_PADDING_X, BOOK_TILE_PADDING_Y } from "@/lib/book-cover";
import { gridCardStyle } from "@/lib/grid-styles";
import { CardTag } from "./card-overlay";

/**
 * Every overlay a grid card draws, on the cards that draw it, so they can be
 * compared side by side: corner badges (platform / reading status), bottom
 * tags and the play indicator.
 */
const meta = {
  title: "Grid/CardOverlays",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

const COVER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#f6d365"/><stop offset="1" stop-color="#fda085"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>',
)}`;

const tweetBase = {
  authorName: "Paul Graham",
  authorUsername: "paulg",
  authorAvatarUrl: null,
  postedAt: "2024-03-01T09:00:00.000Z",
  quotedTweetId: null,
  isTruncated: false,
  quotedTweet: null,
  poll: null,
  inReplyTo: null,
  card: null,
  coverMediaIndex: null,
};

function Tile({
  label,
  aspectRatio,
  children,
}: {
  label: string;
  aspectRatio?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="relative" style={{ width: 220, aspectRatio }}>
        {children}
      </div>
    </div>
  );
}

function ImageTile({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        ...gridCardStyle,
        background: "linear-gradient(135deg, #7dd3fc, #6366f1)",
      }}
    >
      {children}
    </div>
  );
}

function article(readAt: string | null, cover: boolean) {
  return (
    <ArticleCard
      title="The hidden cost of context switching, and how to win it back"
      description="Deep work compounds; every interruption resets the clock and the tax is higher than it feels."
      content={null}
      domain="example.com"
      author="Jane Doe"
      readingTime={6}
      coverUrl={cover ? COVER : null}
      statusBadge={<ArticleReadStatusBadge readAt={readAt} />}
      reserveBadgeSpace
      onClick={noop}
    />
  );
}

function Gallery() {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Tile label="Article · unread">{article(null, false)}</Tile>
      <Tile label="Article · read">
        {article("2024-01-10T00:00:00.000Z", false)}
      </Tile>
      <Tile label="Article · cover, unread" aspectRatio="4 / 5">
        {article(null, true)}
      </Tile>
      <Tile label="Book · reading" aspectRatio="3 / 4">
        <div
          className="relative flex h-full w-full items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950"
          style={{
            ...gridCardStyle,
            padding: `${BOOK_TILE_PADDING_Y * 100}% ${BOOK_TILE_PADDING_X * 100}%`,
          }}
        >
          <BookCover3D
            src="https://covers.openlibrary.org/b/isbn/9780141036144-L.jpg"
            alt="Nineteen Eighty-Four"
          />
          <BookReadingStatusBadge status="reading" />
        </div>
      </Tile>
      <Tile label="Tweet · text">
        <TwitterCard
          twitterDetails={{
            ...tweetBase,
            tweetId: "text",
            authorName: "A very long display name that runs right across",
            text: "The most successful founders are relentlessly resourceful.",
            media: null,
          }}
          itemId="story"
          onClick={noop}
        />
      </Tile>
      <Tile label="Tweet · video" aspectRatio="3 / 2">
        <TwitterCard
          twitterDetails={{
            ...tweetBase,
            tweetId: "video",
            text: "",
            media: [
              {
                type: "video",
                url: COVER,
                posterUrl: COVER,
                width: 1200,
                height: 630,
              },
            ],
          }}
          itemId="story"
          onClick={noop}
        />
      </Tile>
      <Tile label="Instagram" aspectRatio="1 / 1">
        <InstagramCard
          instagramDetails={{
            postId: "post",
            mediaType: "post",
            authorName: "National Geographic",
            authorUsername: "natgeo",
            caption: null,
            postedAt: null,
            media: [{ type: "photo", url: COVER, width: 600, height: 600 }],
            likeCount: null,
            commentCount: null,
            coverMediaIndex: null,
          }}
          onClick={noop}
        />
      </Tile>
      <Tile label="Video" aspectRatio="16 / 9">
        <VideoCard
          videoDetails={{
            platform: "youtube",
            videoId: "v",
            channelName: null,
            channelUrl: null,
            duration: 213,
            embedUrl: "",
            thumbnailUrl: COVER,
          }}
          coverFileKey={null}
          title="A video"
          onClick={noop}
        />
      </Tile>
      <Tile label="Product" aspectRatio="5 / 6">
        <ImageTile>
          <CardTag corner="bottom-left">£129</CardTag>
        </ImageTile>
      </Tile>
      <Tile label="Document" aspectRatio="3 / 4">
        <ImageTile>
          <CardTag corner="bottom-right">
            <Files aria-hidden="true" />3
          </CardTag>
        </ImageTile>
      </Tile>
      <Tile label="Tweet · GIF" aspectRatio="3 / 2">
        <TwitterCard
          twitterDetails={{
            ...tweetBase,
            tweetId: "gif",
            text: "",
            media: [
              {
                type: "animated_gif",
                url: COVER,
                posterUrl: COVER,
                width: 1200,
                height: 630,
                // The GIF tag shows on the autoplaying card, which needs an mp4
                variants: [
                  { type: "video/mp4", src: "https://video.twimg.com/x.mp4" },
                ],
              },
            ],
          }}
          itemId="story"
          onClick={noop}
        />
      </Tile>
    </div>
  );
}

export const AllOverlays: Story = { render: () => <Gallery /> };
