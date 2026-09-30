import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeJsxEntities,
  extractLabelsFromSource,
  extractUiLabels,
  isDevOnly,
} from "./extract-ui-labels";
import { UI_LABELS } from "./ui-labels.generated";

describe("extractLabelsFromSource", () => {
  it("collects literal UI copy", () => {
    const labels = extractLabelsFromSource(`
      <Button aria-label="Close dialog" title={open ? "Hide" : "Show"}>
        <Trash /> Delete
        {isPending ? <IsLoading label="Deleting" /> : "Delete item"}
        {confirming && "Confirm?"}
      </Button>
    `);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Close dialog",
        "Hide",
        "Show",
        "Delete",
        "Deleting",
        "Delete item",
        "Confirm?",
      ]),
    );
  });

  it("never collects text rendered from data", () => {
    const labels = extractLabelsFromSource(`
      <button aria-label={item.title}>{tag}{room.name}{\`#\${tag}\`}</button>
    `);
    expect(labels).toEqual([]);
  });
});

describe("decodeJsxEntities", () => {
  it("decodes the entities JSX text renders", () => {
    expect(
      decodeJsxEntities("don&apos;t &amp; &quot;x&quot; &#39;y&#x27;"),
    ).toBe("don't & \"x\" 'y'");
  });

  it("leaves unknown and out-of-range entities alone", () => {
    expect(decodeJsxEntities("&bogus;")).toBe("&bogus;");
    expect(decodeJsxEntities("&#x110000;")).toBe("&#x110000;");
  });

  it("is applied to JSX text only", () => {
    expect(
      extractLabelsFromSource(`<p title="a &amp; b">don&apos;t</p>`),
    ).toEqual(["a &amp; b", "don't"]);
  });
});

describe("isDevOnly", () => {
  it("matches both dev route roots", () => {
    expect(isDevOnly("app/(dev)/dev/images/design-editor.tsx")).toBe(true);
    expect(isDevOnly("app/(app)/dev/colors/page.tsx")).toBe(true);
  });

  it("keeps everything else", () => {
    expect(isDevOnly("app/(app)/dashboard/item-card.tsx")).toBe(false);
    expect(isDevOnly("components/dev-notes.tsx")).toBe(false);
  });
});

describe("UI_LABELS", () => {
  it("is up to date with the source (run: bun scripts/generate-ui-labels.ts)", () => {
    expect(extractUiLabels(join(process.cwd(), "src"))).toEqual(UI_LABELS);
  });
});
