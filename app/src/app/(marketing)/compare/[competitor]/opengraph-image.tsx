import { getComparison } from "@/lib/comparisons";
import {
  fallbackOgImage,
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  ogImageResponse,
} from "@/lib/og/render";

export const alt = "abode compared";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const comparison = getComparison((await params).competitor);
  if (!comparison) return fallbackOgImage();

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
        <div style={{ fontSize: 34, color: OG_COLORS.muted }}>compare</div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontFamily: "Hedvig",
            fontSize: 104,
            lineHeight: 1.05,
          }}
        >
          {`abode vs ${comparison.name}`}
        </div>
        <div style={{ marginTop: 32, fontSize: 38, color: OG_COLORS.muted }}>
          open source. self-hostable. no ads.
        </div>
      </div>
    </OgFrame>,
  );
}
