import type { CaptureResult } from "posthog-js";
import { afterEach, describe, expect, it } from "vitest";
import { setAnalyticsUsername } from "./analytics-username";
import { isUiLabel, scrubElementsChain, scrubEvent } from "./scrub-event";

function event(properties: CaptureResult["properties"]): CaptureResult {
  return { uuid: "u", event: "$autocapture", properties };
}

describe("isUiLabel", () => {
  it("recognises UI copy from the source, ignoring spacing", () => {
    expect(isUiLabel("Save")).toBe(true);
    expect(isUiLabel("  Delete ")).toBe(true);
  });

  it("rejects text that isn't in the source", () => {
    expect(isUiLabel("My secret shopping list")).toBe(false);
  });
});

describe("scrubEvent", () => {
  afterEach(() => setAnalyticsUsername(null));

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
