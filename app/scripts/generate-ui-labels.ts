/**
 * Regenerates src/lib/analytics/ui-labels.generated.ts — the UI copy that
 * PostHog autocapture may record as click text (see scrub-event.ts).
 * `ui-labels.test.ts` fails when it's stale.
 *
 *   bun scripts/generate-ui-labels.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractUiLabels } from "../src/lib/analytics/extract-ui-labels";
import {
  renderUiLabelsModule,
  UI_LABELS_PATH,
} from "../src/lib/analytics/ui-labels-module";

const root = join(import.meta.dirname, "..");
const labels = extractUiLabels(join(root, "src"));
writeFileSync(join(root, UI_LABELS_PATH), renderUiLabelsModule(labels));
console.log(`Wrote ${labels.length} labels to ${UI_LABELS_PATH}`);
