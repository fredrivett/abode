import { getDisplayName } from "@/lib/get-display-name";
import { getOgProfile, parseOgUsername } from "@/lib/og/data";
import {
  fallbackOgImage,
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgAvatar,
  OgFrame,
  ogImageResponse,
  safeAvatarUrl,
} from "@/lib/og/render";

export const alt = "Profile on abode";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = parseOgUsername(rawUsername);
  const profile = username ? await getOgProfile(username) : null;

  if (!profile) return fallbackOgImage();

  const displayName = getDisplayName(profile);
  const initial = profile.firstName?.[0] ?? profile.username?.[0] ?? "?";

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
        <OgAvatar src={safeAvatarUrl(profile.avatarUrl)} initial={initial} />
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontFamily: "Hedvig",
            fontSize: 76,
            lineHeight: 1.05,
          }}
        >
          {displayName || `@${profile.username}`}
        </div>
        {displayName && (
          <div style={{ marginTop: 8, fontSize: 34, color: OG_COLORS.muted }}>
            {`@${profile.username}`}
          </div>
        )}
        <div style={{ marginTop: 24, fontSize: 32, color: OG_COLORS.muted }}>
          {`${pluralize(profile.itemCount, "item")}  ·  ${pluralize(
            profile.roomCount,
            "room",
          )}`}
        </div>
      </div>
    </OgFrame>,
  );
}
