import { browser } from "wxt/browser";

/**
 * Captures the active tab's fully-rendered DOM (after the page's JS has run) so
 * the server can classify/enrich against what the user actually sees, instead of
 * a bare server-side fetch. Runs a one-shot script in the same active tab the
 * user gestured on — activeTab covers it, so there's no broad host-permission
 * prompt.
 *
 * Returns null when capture isn't possible (restricted pages like chrome://, the
 * Web Store, view-source, or the PDF viewer, where scripts can't run) so callers
 * fall back to a plain URL save.
 */
export async function captureRenderedHtml(
  tabId: number,
): Promise<string | null> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML,
    });
    const html = injection?.result;
    return typeof html === "string" && html.length > 0 ? html : null;
  } catch {
    return null;
  }
}
