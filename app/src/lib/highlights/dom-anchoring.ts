/**
 * DOM Anchoring Utilities
 *
 * Convert between DOM Range objects and character offsets.
 * Based on the W3C Web Annotation Data Model approach.
 */

export type TextPosition = {
  start: number;
  end: number;
};

export type TextQuote = {
  exact: string;
  prefix: string;
  suffix: string;
};

export type HighlightAnchor = {
  position: TextPosition;
  quote: TextQuote;
};

const CONTEXT_LENGTH = 32;

/**
 * Calculate the absolute character offset of a point within a container.
 * Iterates through all text nodes to find the cumulative position.
 */
function getTextOffset(container: Element, node: Node, offset: number): number {
  const iterator = document.createNodeIterator(container, NodeFilter.SHOW_TEXT);
  let charCount = 0;

  for (
    let current = iterator.nextNode();
    current !== null;
    current = iterator.nextNode()
  ) {
    if (current === node) {
      return charCount + offset;
    }
    charCount += current.textContent?.length ?? 0;
  }

  return charCount;
}

/**
 * Get the full text content of a container (same as textContent but explicit).
 */
function getTextContent(container: Element): string {
  return container.textContent ?? "";
}

/**
 * Convert a DOM Range to absolute character offsets within a container.
 */
export function fromRange(container: Element, range: Range): TextPosition {
  return {
    start: getTextOffset(container, range.startContainer, range.startOffset),
    end: getTextOffset(container, range.endContainer, range.endOffset),
  };
}

/**
 * Convert character offsets back to a DOM Range within a container.
 * Returns null if offsets are out of bounds.
 */
export function toRange(
  container: Element,
  start: number,
  end: number,
): Range | null {
  const iterator = document.createNodeIterator(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let charCount = 0;
  let foundStart = false;

  for (
    let current = iterator.nextNode() as Text | null;
    current !== null;
    current = iterator.nextNode() as Text | null
  ) {
    const length = current.textContent?.length ?? 0;

    // Find start position
    if (!foundStart && charCount + length > start) {
      range.setStart(current, start - charCount);
      foundStart = true;
    }

    // Find end position
    // biome-ignore lint/nursery/noUnnecessaryConditions: foundStart is mutable and can be true here
    if (foundStart && charCount + length >= end) {
      range.setEnd(current, end - charCount);
      return range;
    }

    charCount += length;
  }

  return null;
}

/**
 * Create a TextQuote selector with surrounding context.
 * Used for resilient matching when document structure changes.
 */
export function createQuoteSelector(
  container: Element,
  position: TextPosition,
): TextQuote {
  const text = getTextContent(container);
  const { start, end } = position;

  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(end, Math.min(text.length, end + CONTEXT_LENGTH)),
  };
}

/**
 * Create a full anchor with both position and quote selectors.
 */
export function createAnchor(
  container: Element,
  range: Range,
): HighlightAnchor {
  const position = fromRange(container, range);
  const quote = createQuoteSelector(container, position);
  return { position, quote };
}

/**
 * Wrap a range with a highlight mark element.
 * Handles ranges that span multiple elements by wrapping each text node portion.
 *
 * Returns an array of the created mark elements.
 */
export function wrapRangeWithHighlight(
  range: Range,
  highlightId: string,
  className: string,
): HTMLElement[] {
  const marks: HTMLElement[] = [];

  // Simple case: range is within a single text node
  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    const mark = document.createElement("mark");
    mark.dataset.highlightId = highlightId;
    mark.className = className;

    try {
      range.surroundContents(mark);
      marks.push(mark);
      return marks;
    } catch {
      // surroundContents fails when range partially selects a non-Text node.
      // Fall through to complex case which handles cross-element ranges.
    }
  }

  // Complex case: range spans multiple nodes
  // Collect all text nodes within the range
  const textNodes = getTextNodesInRange(range);

  for (const { node, startOffset, endOffset } of textNodes) {
    const text = node.textContent ?? "";
    const highlightedText = text.slice(startOffset, endOffset);

    if (!highlightedText) continue;

    // Create mark element
    const mark = document.createElement("mark");
    mark.dataset.highlightId = highlightId;
    mark.className = className;
    mark.textContent = highlightedText;

    // Split the text node and insert the mark
    const parent = node.parentNode;
    if (!parent) continue;

    if (startOffset > 0) {
      // Text before highlight
      const before = document.createTextNode(text.slice(0, startOffset));
      parent.insertBefore(before, node);
    }

    parent.insertBefore(mark, node);

    if (endOffset < text.length) {
      // Text after highlight
      const after = document.createTextNode(text.slice(endOffset));
      parent.insertBefore(after, node);
    }

    parent.removeChild(node);
    marks.push(mark);
  }

  return marks;
}

type TextNodeSegment = {
  node: Text;
  startOffset: number;
  endOffset: number;
};

/**
 * Get all text nodes within a range with their relevant offsets.
 */
function getTextNodesInRange(range: Range): TextNodeSegment[] {
  const segments: TextNodeSegment[] = [];
  const container = range.commonAncestorContainer;

  // If the common ancestor is a text node, it's the only node
  if (container.nodeType === Node.TEXT_NODE) {
    segments.push({
      node: container as Text,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    });
    return segments;
  }

  // Iterate through text nodes in the container
  const iterator = document.createNodeIterator(
    container as Element,
    NodeFilter.SHOW_TEXT,
  );
  let inRange = false;

  for (
    let current = iterator.nextNode() as Text | null;
    current !== null;
    current = iterator.nextNode() as Text | null
  ) {
    const isStart = current === range.startContainer;
    const isEnd = current === range.endContainer;

    if (isStart) {
      inRange = true;
      segments.push({
        node: current,
        startOffset: range.startOffset,
        endOffset: isEnd ? range.endOffset : (current.textContent?.length ?? 0),
      });
      if (isEnd) break;
      continue;
    }

    if (isEnd) {
      segments.push({
        node: current,
        startOffset: 0,
        endOffset: range.endOffset,
      });
      break;
    }

    // biome-ignore lint/nursery/noUnnecessaryConditions: inRange is mutable and can be true here
    if (inRange) {
      segments.push({
        node: current,
        startOffset: 0,
        endOffset: current.textContent?.length ?? 0,
      });
    }
  }

  return segments;
}
