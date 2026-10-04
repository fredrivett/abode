import type { CaptureResult } from "posthog-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  resetAnalyticsUsername,
  setAnalyticsUsername,
} from "./analytics-username";
import { scrubElementsChain, scrubEvent } from "./scrub-event";
import { setUiLabels } from "./ui-labels";

function event(properties: CaptureResult["properties"]): CaptureResult {
  return { uuid: "u", event: "$autocapture", properties };
}

// Stands in for the list next.config.ts inlines at build time
beforeAll(() => setUiLabels(["Save", "Delete", "Close"]));
afterAll(() => setUiLabels([]));

describe("scrubEvent", () => {
  afterEach(() => resetAnalyticsUsername());

  it("passes null through", () => {
    expect(scrubEvent(null)).toBeNull();
  });

  it("keeps UI click text and drops user content", () => {
    expect(scrubEvent(event({ $el_text: "Delete" }))?.properties.$el_text).toBe(
      "Delete",
    );
    expect(
      scrubEvent(event({ $el_text: "Notes from therapy" }))?.properties,
    ).not.toHaveProperty("$el_text");
  });

  it("scrubs each autocaptured element", () => {
    const scrubbed = scrubEvent(
      event({
        $elements: [
          {
            tag_name: "button",
            $el_text: "Save",
            classes: ["btn"],
            "attr__aria-label": "Close",
            attr__class: "btn",
            "attr__data-state": "open",
          },
          {
            tag_name: "a",
            $el_text: "An article I saved",
            attr__href: "https://example.com/private",
            attr__title: "An article I saved",
            "attr__data-room-json": '{"title":"Plans"}',
          },
        ],
      }),
    );
    expect(scrubbed?.properties.$elements).toEqual([
      {
        tag_name: "button",
        $el_text: "Save",
        classes: ["btn"],
        "attr__aria-label": "Close",
        attr__class: "btn",
        "attr__data-state": "open",
      },
      { tag_name: "a" },
    ]);
  });

  it("scrubs top-level target attributes", () => {
    const scrubbed = scrubEvent(
      event({
        "$el_attr__aria-label": "Close",
        $el_attr__href: "https://example.com/private",
        $el_attr__title: "An article I saved",
        "$el_attr__data-text": "shared text",
        $el_attr__class: "btn",
      }),
    );
    expect(scrubbed?.properties).toEqual({
      "$el_attr__aria-label": "Close",
      $el_attr__class: "btn",
    });
  });

  it("drops properties that only carry page content", () => {
    const scrubbed = scrubEvent(
      event({
        $external_click_url: "https://example.com/private",
        $selected_content: "copied text",
        $element_selectors: ['a[href="https://example.com/private"]'],
      }),
    );
    expect(scrubbed?.properties).toEqual({});
  });

  it("masks content in every URL property, including person properties", () => {
    setAnalyticsUsername("fred");
    const scrubbed = scrubEvent({
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: "https://abode.test/@fred/plans?q=secret",
        $pathname: "/@fred/plans",
        $referrer: "https://abode.test/dashboard?q=secret",
      },
      $set_once: { $initial_current_url: "https://abode.test/@fred/plans" },
    });
    expect(scrubbed?.properties).toEqual({
      $current_url: "https://abode.test/@fred/[room]?q=<masked>",
      $pathname: "/@fred/[room]",
      $referrer: "https://abode.test/dashboard?q=<masked>",
    });
    expect(scrubbed?.$set_once).toEqual({
      $initial_current_url: "https://abode.test/@fred/[room]",
    });
  });
});

describe("scrubElementsChain", () => {
  it("keeps UI text and structure, dropping content", () => {
    const chain =
      'button.btn:text="Save"attr__aria-label="Close"nth-child="1";' +
      'a:text="My \\"secret\\" note"href="https://example.com/x"attr__href="https://example.com/x"attr__title="My note"attr_id="card"';
    expect(scrubElementsChain(chain)).toBe(
      'button.btn:text="Save"attr__aria-label="Close"nth-child="1";a:attr_id="card"',
    );
  });
});
