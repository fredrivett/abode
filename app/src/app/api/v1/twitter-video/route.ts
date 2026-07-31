import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("api/v1/twitter-video");

const ALLOWED_HOSTS = new Set(["video.twimg.com"]);
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, immutable";

const PASSTHROUGH_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

/**
 * Streaming proxy for Twitter video CDN.
 *
 * video.twimg.com returns 403 when the browser sends Referer from our
 * origin. Fetching server-side (no Referer) returns 200, so we pipe the
 * bytes through. Range requests are forwarded so the <video> element
 * can seek without downloading the whole file.
 */
export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ message: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ message: "invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.host) || parsed.protocol !== "https:") {
    return NextResponse.json({ message: "host not allowed" }, { status: 400 });
  }

  const upstreamHeaders: Record<string, string> = {};
  const range = request.headers.get("range");
  if (range) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    // Raw fetch is deliberate: the host is allowlisted to video.twimg.com above,
    // and the body is streamed straight through (safeFetch caps body size, which
    // would truncate a video). Exempted from the no-raw-fetch plugin by path in
    // biome.json.
    upstream = await fetch(parsed.toString(), {
      headers: upstreamHeaders,
      redirect: "follow",
    });
  } catch (error) {
    log.error({ error, url: parsed.toString() }, "upstream fetch failed");
    return NextResponse.json(
      { message: "upstream fetch failed" },
      { status: 502 },
    );
  }

  if (upstream.status >= 400) {
    log.warn(
      { url: parsed.toString(), status: upstream.status },
      "upstream returned error",
    );
    return new NextResponse(null, { status: upstream.status });
  }

  const responseHeaders = new Headers();
  for (const key of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }
  responseHeaders.set("Cache-Control", CACHE_CONTROL);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
