import { getOgRoom, parseOgUsername } from "@/lib/og/data";
import {
  fallbackOgImage,
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  ogImageResponse,
} from "@/lib/og/render";

export const alt = "Room on abode";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username: rawUsername, slug } = await params;
  const username = parseOgUsername(rawUsername);
  const room = username ? await getOgRoom(username, slug) : null;

  if (!room) return fallbackOgImage();

  return ogImageResponse(
    <OgFrame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {room.emoji && (
          <div style={{ display: "flex", fontSize: 132, lineHeight: 1 }}>
            {room.emoji}
          </div>
        )}
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontFamily: "Hedvig",
            fontSize: 82,
            lineHeight: 1.05,
          }}
        >
          {room.name}
        </div>
        <div style={{ marginTop: 16, fontSize: 34, color: OG_COLORS.muted }}>
          {`${pluralize(room.itemCount, "item")}  ·  by @${room.ownerUsername}`}
        </div>
      </div>
    </OgFrame>,
  );
}
