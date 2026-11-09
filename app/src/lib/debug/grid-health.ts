import {
  CARD_FIT_ATTR,
  type CardFitIssue,
  cardFitIssue,
  isCardFitKind,
} from "@/lib/items/card-fit";

export type GridHealthIssue = {
  id: string;
  /** `invisible`: a settled cell with no height or opacity — the user sees nothing */
  issue: "invisible" | CardFitIssue;
  frame: number;
  natural?: number;
};

/**
 * Problems a user would see in a settled masonry grid: cells left invisible,
 * and content-sized cards whose content doesn't fit the frame the grid
 * reserved (see `cardFitIssue`). Re-measures those cards at their natural
 * height from clones in an offscreen probe, so the grid itself isn't touched.
 */
export function checkGridHealth(root: HTMLElement): GridHealthIssue[] {
  const issues: GridHealthIssue[] = [];
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {
    position: "absolute",
    left: "-100000px",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
  });
  const measured: Array<{
    id: string;
    kind: Parameters<typeof cardFitIssue>[0]["kind"];
    width: number;
    frame: number;
    clone: HTMLElement;
  }> = [];

  for (const cell of root.querySelectorAll<HTMLElement>("[data-grid-item]")) {
    const id = cell.dataset.gridItem ?? "";
    const { width, height } = cell.getBoundingClientRect();
    if (height < 1 || getComputedStyle(cell).opacity === "0") {
      issues.push({ id, issue: "invisible", frame: height });
      continue;
    }
    const card = cell.querySelector<HTMLElement>(`[${CARD_FIT_ATTR}]`);
    const kind = card?.getAttribute(CARD_FIT_ATTR) ?? null;
    if (!card || !isCardFitKind(kind)) continue;
    const wrapper = document.createElement("div");
    wrapper.style.width = `${width}px`;
    // Card text scales with the grid's density
    wrapper.style.setProperty(
      "--grid-font-scale",
      getComputedStyle(cell).getPropertyValue("--grid-font-scale"),
    );
    const clone = card.cloneNode(true);
    if (!(clone instanceof HTMLElement)) continue;
    wrapper.appendChild(clone);
    probe.appendChild(wrapper);
    measured.push({ id, kind, width, frame: height, clone });
  }

  if (measured.length > 0) {
    // One insert, then all reads: a single layout pass
    document.body.appendChild(probe);
    for (const { id, kind, width, frame, clone } of measured) {
      const natural = clone.getBoundingClientRect().height;
      const issue = cardFitIssue({ kind, width, frame, natural });
      if (issue) issues.push({ id, issue, frame, natural });
    }
    probe.remove();
  }
  return issues;
}
