import {
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  ogImageResponse,
} from "@/lib/og/render";

export const alt = "abode — your home should be yours";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
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
        <div
          style={{
            display: "flex",
            fontFamily: "Hedvig",
            fontSize: 96,
            lineHeight: 1.05,
          }}
        >
          your home should be yours.
        </div>
        <div style={{ marginTop: 32, fontSize: 40, color: OG_COLORS.muted }}>
          save everything. sort nothing. own it all.
        </div>
      </div>
    </OgFrame>,
  );
}
