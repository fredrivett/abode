import { getOgItem, parseOgUsername } from "@/lib/og/data";
import {
  coverImageUrl,
  fallbackOgImage,
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  ogImageResponse,
} from "@/lib/og/render";

export const alt = "Item on abode";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const KIND_LABELS: Record<string, string> = {
  image: "Image",
  article: "Article",
  twitter: "Post",
  instagram: "Instagram post",
  video: "Video",
  product: "Product",
  note: "Note",
  webpage: "Page",
  book: "Book",
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        padding: "8px 18px",
        borderRadius: 999,
        border: `1px solid ${OG_COLORS.border}`,
        backgroundColor: OG_COLORS.surface,
        fontSize: 26,
        fontWeight: 600,
        color: OG_COLORS.fg,
      }}
    >
      {KIND_LABELS[kind] ?? "Item"}
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username: rawUsername, id } = await params;
  const username = parseOgUsername(rawUsername);
  const item = username ? await getOgItem(username, id) : null;

  if (!item) return fallbackOgImage();

  const cover = coverImageUrl(item.coverFileKey ?? item.fileKey, "grid");
  const title = item.title ?? "Untitled";

  // With a cover: hero image on the left, meta on the right.
  if (cover) {
    return ogImageResponse(
      <OgFrame>
        <div style={{ display: "flex", flex: 1, gap: 56 }}>
          {/* biome-ignore lint/performance/noImgElement: next/og (satori) renders raw <img>; next/image is unavailable here */}
          <img
            src={cover}
            width={460}
            height={460}
            alt=""
            style={{
              width: 460,
              height: 460,
              borderRadius: 24,
              objectFit: "cover",
              border: `1px solid ${OG_COLORS.border}`,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              gap: 24,
            }}
          >
            <KindBadge kind={item.kind} />
            <div
              style={{
                display: "flex",
                fontFamily: "Hedvig",
                fontSize: 62,
                lineHeight: 1.1,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 30, color: OG_COLORS.muted }}>
              {`@${item.ownerUsername}`}
            </div>
          </div>
        </div>
      </OgFrame>,
    );
  }

  // No cover: centered text card.
  return ogImageResponse(
    <OgFrame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          gap: 28,
        }}
      >
        <KindBadge kind={item.kind} />
        <div
          style={{
            display: "flex",
            fontFamily: "Hedvig",
            fontSize: 78,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 32, color: OG_COLORS.muted }}>
          {`@${item.ownerUsername}`}
        </div>
      </div>
    </OgFrame>,
  );
}
