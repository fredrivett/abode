import type { PostHogConfig } from "posthog-js";

type SessionRecordingOptions = NonNullable<PostHogConfig["session_recording"]>;

// Attributes that can carry what a user saved: link targets, image sources,
// metadata, and text surfaced through alt/title/aria labels
const CONTENT_ATTRIBUTES = new Set([
  "href",
  "xlink:href",
  "src",
  "srcset",
  "poster",
  "action",
  "formaction",
  "cite",
  "content",
  "value",
  "label",
  "alt",
  "title",
  "aria-label",
  "aria-description",
  "aria-valuetext",
]);

// `data-*` attributes whose values drive styling (`data-[state=open]:…`);
// every other `data-*` value is blanked, keeping the attribute so presence
// selectors like `[data-grid-item]` still match
const UI_STATE_DATA_ATTRIBUTES = new Set([
  "data-state",
  "data-side",
  "data-align",
  "data-orientation",
  "data-slot",
  "data-variant",
  "data-size",
  "data-disabled",
  "data-active",
  "data-focused",
  "data-selected",
  "data-selected-single",
  "data-highlighted",
  "data-inset",
  "data-range-start",
  "data-range-end",
  "data-range-middle",
  "data-placeholder",
  "data-flash",
  "data-error",
  "data-status",
  "data-layer",
]);

const CSS_URL = /url\((?:[^()]|\([^()]*\))*\)/gi;

/**
 * Blanks attribute values that could reveal user content in a replay, keeping
 * layout-only attributes (class, style, sizes, UI-state `data-*`) and `<link>`
 * tags so recordings still render. Inline `url(...)` backgrounds in style are
 * stripped for the same reason.
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
  if (attribute.startsWith("data-")) {
    return UI_STATE_DATA_ATTRIBUTES.has(attribute) ? value : "";
  }
  if (attribute === "style") return value.replace(CSS_URL, "none");
  return value;
}

/**
 * Session replay records how abode is used, not what people save: every
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

/**
 * Query params that carry user content: search queries (`q`, `search`) and
 * links/text shared to `/save`. Masked in page URLs on analytics events and
 * in replay metadata.
 */
export const CONTENT_QUERY_PARAMS = ["q", "search", "url", "text", "title"];

/** Privacy settings spread into `posthog.init` */
export const POSTHOG_PRIVACY_CONFIG = {
  session_recording: REPLAY_PRIVACY_OPTIONS,
  mask_personal_data_properties: true,
  custom_personal_data_properties: CONTENT_QUERY_PARAMS,
} satisfies Partial<PostHogConfig>;
