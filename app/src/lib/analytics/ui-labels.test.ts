import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractLabelsFromSource, extractUiLabels } from "./extract-ui-labels";
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

describe("UI_LABELS", () => {
  it("is up to date with the source (run: bun scripts/generate-ui-labels.ts)", () => {
    expect(extractUiLabels(join(process.cwd(), "src"))).toEqual(UI_LABELS);
  });
});
