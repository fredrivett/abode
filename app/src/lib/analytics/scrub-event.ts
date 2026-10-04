import type { CaptureResult, Properties } from "posthog-js";
import { maskContentInUrl } from "./mask-url";
import { maskReplayAttribute } from "./replay-privacy";
import { isUiLabel } from "./ui-labels";

// Attributes that are UI copy when written literally, content otherwise
const LABEL_ATTRIBUTES = new Set(["title", "aria-label", "label"]);

/** An autocaptured attribute's value to send, or null to drop it */
function scrubAttribute(name: string, value: string): string | null {
  if (LABEL_ATTRIBUTES.has(name.toLowerCase())) {
    return isUiLabel(value) ? value : null;
  }
  const masked = maskReplayAttribute(name, value);
  return masked === "" && value !== "" ? null : masked;
}

function scrubElement(element: unknown): unknown {
  if (typeof element !== "object" || element === null) return element;
  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(element)) {
    if (key === "$el_text") {
      if (typeof value === "string" && isUiLabel(value)) scrubbed[key] = value;
    } else if (key.startsWith("attr__") && typeof value === "string") {
      const kept = scrubAttribute(key.slice("attr__".length), value);
      if (kept !== null) scrubbed[key] = kept;
    } else {
      scrubbed[key] = value;
    }
  }
  return scrubbed;
}

// A `key="value"` pair follows the element's `tag.classes:` prefix or the
// previous pair's closing quote
const CHAIN_PAIR = /(?<=[:"])(attr__[\w:-]+|[\w-]+)="((?:[^"\\]|\\.)*)"/g;

/** Same scrubbing over the serialized `$elements_chain` form */
export function scrubElementsChain(chain: string): string {
  return chain.replace(CHAIN_PAIR, (pair, key: string, raw: string) => {
    const value = raw.replace(/\\(.)/g, "$1");
    if (key === "text") return isUiLabel(value) ? pair : "";
    if (key === "href") return "";
    if (!key.startsWith("attr__")) return pair;
    const kept = scrubAttribute(key.slice("attr__".length), value);
    if (kept === null) return "";
    return kept === value ? pair : `${key}="${kept.replace(/"/g, '\\"')}"`;
  });
}

// Autocapture properties that only ever carry page content
const DROPPED_PROPERTIES = [
  "$external_click_url",
  "$selected_content",
  "$element_selectors",
];

function scrubProperties(properties: Properties | undefined): void {
  if (!properties) return;
  for (const key of DROPPED_PROPERTIES) delete properties[key];

  if (
    typeof properties.$el_text === "string" &&
    !isUiLabel(properties.$el_text)
  ) {
    delete properties.$el_text;
  }
  if (Array.isArray(properties.$elements)) {
    properties.$elements = properties.$elements.map(scrubElement);
  }
  if (typeof properties.$elements_chain === "string") {
    properties.$elements_chain = scrubElementsChain(properties.$elements_chain);
  }
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== "string" || key === "$elements_chain") continue;
    if (key.startsWith("$el_attr__")) {
      const kept = scrubAttribute(key.slice("$el_attr__".length), value);
      if (kept === null) delete properties[key];
      else properties[key] = maskContentInUrl(kept);
    } else {
      properties[key] = maskContentInUrl(value);
    }
  }
}

/**
 * PostHog `before_send`: keeps analytics about how abode is used while
 * stripping what people save. Click text and label attributes survive only
 * when they're UI copy from the source (so "Save" and "Delete" stay
 * readable); link targets and other content attributes are dropped; content
 * query params and the owner's room names are masked in every URL property.
 */
export function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  scrubProperties(event.properties);
  scrubProperties(event.$set);
  scrubProperties(event.$set_once);
  return event;
}
