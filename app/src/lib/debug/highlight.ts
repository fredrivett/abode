/**
 * Flash outlines over page regions (layout shifts, frames the grid moved) in a
 * fixed overlay layer. Drawn outside the app tree on purpose — touching styles
 * inside the masonry grid would itself trigger a reflow and pollute the trace.
 */

const LAYER_ID = "abode-debug-highlights";
const FLASH_MS = 900;

export type HighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HighlightTone = "shift" | "move";

const TONE_COLORS: Record<HighlightTone, string> = {
  shift: "rgba(239, 68, 68, 0.9)",
  move: "rgba(59, 130, 246, 0.9)",
};

function getLayer(): HTMLElement {
  const existing = document.getElementById(LAYER_ID);
  if (existing) return existing;
  const layer = document.createElement("div");
  layer.id = LAYER_ID;
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2147483646",
  });
  document.body.appendChild(layer);
  return layer;
}

/** Outline viewport-relative rects briefly. */
export function flashRects(rects: HighlightRect[], tone: HighlightTone): void {
  if (rects.length === 0) return;
  const layer = getLayer();
  for (const rect of rects) {
    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "absolute",
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      outline: `2px solid ${TONE_COLORS[tone]}`,
      outlineOffset: "-1px",
      borderRadius: "4px",
      transition: `opacity ${FLASH_MS}ms ease-in`,
    });
    layer.appendChild(box);
    requestAnimationFrame(() => {
      box.style.opacity = "0";
    });
    setTimeout(() => box.remove(), FLASH_MS + 50);
  }
}

export function removeHighlightLayer(): void {
  document.getElementById(LAYER_ID)?.remove();
}
