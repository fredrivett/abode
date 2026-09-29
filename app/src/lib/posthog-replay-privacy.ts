import type { PostHogConfig } from "posthog-js";

type SessionRecordingOptions = NonNullable<PostHogConfig["session_recording"]>;

// Attributes that can carry what a user saved: link targets, image sources,
// and text surfaced through alt/title/aria labels
const CONTENT_ATTRIBUTES = new Set([
  "href",
  "src",
  "srcset",
  "poster",
  "alt",
  "title",
  "aria-label",
  "aria-description",
  "aria-valuetext",
]);

const CSS_URL = /url\((?:[^()]|\([^()]*\))*\)/gi;

/**
 * Blanks attribute values that could reveal user content in a replay, keeping
 * layout-only attributes (class, style, sizes) and `<link>` tags so recordings
 * still render.
 * Inline `url(...)` backgrounds in style are stripped for the same reason.
 */
export function maskReplayAttribute(
  name: string,
  value: string,
  element?: Element,
): string {
  const attribute = name.toLowerCase();
  // Stylesheet links are app assets the replay needs to render
  if (element?.tagName === "LINK") return value;
  if (CONTENT_ATTRIBUTES.has(attribute)) return "";
  if (attribute === "style") return value.replace(CSS_URL, "none");
  return value;
}

/**
 * Session replay records how abode is used, never what people save: every
 * input value and text node is masked, media is replaced by same-size
 * placeholders, and content-bearing attributes are blanked. Masking is
 * global rather than opt-in per component, so new UI can't leak by default.
 */
export const REPLAY_PRIVACY_OPTIONS = {
  maskAllInputs: true,
  maskTextSelector: "*",
  blockSelector: "img, picture, video, audio, canvas, iframe, object, embed",
  maskAttributeFn: maskReplayAttribute,
} satisfies SessionRecordingOptions;
