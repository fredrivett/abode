import { defineContentScript } from "#imports";
import { browser } from "wxt/browser";

// Handshake message types, shared with the web app's <ExtensionDetector>.
const PING = "ABODE_EXT_PING";
const PONG = "ABODE_EXT_PONG";

/**
 * Announces the extension's presence to the abode web app.
 *
 * The page and this content script share the same window message bus. We reply
 * to the page's PING with a PONG carrying our version, and also announce once on
 * load so the page detects us even if it mounted before we injected. localhost
 * matches any dev port; abode.fyi is production.
 */
// Local builds (WXT_ABODE_LOCAL=1) also target the dev server on localhost;
// production only ever runs on abode.fyi, so it must not inject elsewhere.
const matches = ["https://www.abode.fyi/*"];
if (import.meta.env.WXT_ABODE_LOCAL === "1") {
  matches.push("http://localhost/*");
}

export default defineContentScript({
  matches,
  main() {
    const { version } = browser.runtime.getManifest();
    const announce = () =>
      window.postMessage({ type: PONG, version }, window.location.origin);

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.type === PING) announce();
    });

    announce();
  },
});
