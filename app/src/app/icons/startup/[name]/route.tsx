import { ImageResponse } from "next/og";
import { AbodeWordmark } from "@/lib/og/render";
import { STARTUP_IMAGES, WORDMARK_HEIGHT } from "@/lib/pwa/startup-images";

// The iOS startup images (see src/lib/pwa/startup-images.ts), rendered once at build
export function generateStaticParams() {
  return STARTUP_IMAGES.map(({ name }) => ({ name }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const image = STARTUP_IMAGES.find((i) => i.name === name);
  if (!image) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: image.background,
      }}
    >
      {/* Faded like the header's logo */}
      <div style={{ display: "flex", opacity: 0.5 }}>
        <AbodeWordmark
          height={WORDMARK_HEIGHT * image.ratio}
          color={image.foreground}
        />
      </div>
    </div>,
    { width: image.width, height: image.height },
  );
}
