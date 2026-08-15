import { execSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, chromium, expect, test } from "@playwright/test";

// `chrome` exists in the extension service-worker context these functions are
// serialized into — never in this Node test process, so a minimal ambient
// declaration is enough to type them without pulling in @types/chrome.
declare const chrome: {
  tabs: {
    query(q: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<Array<{ id?: number }>>;
  };
  scripting: {
    executeScript(o: {
      target: { tabId: number };
      func: () => string;
    }): Promise<Array<{ result?: string }>>;
  };
};

const dir = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(dir, "../.output/chrome-mv3");

// Distinctive content added by the page's own JS *after* load — precisely what a
// server-side fetch can't see and what this capture path exists to recover. The
// marker is base64-encoded in source and decoded at runtime, so the literal
// appears ONLY in the rendered DOM, never in the raw HTML a fetch would return.
const MARKER = "POST-RENDER-CONTENT-9f3a";
const MARKER_B64 = Buffer.from(MARKER).toString("base64");
const PAGE_HTML = `<!doctype html><html><head><title>capture test</title></head><body>
  <h1>server-visible heading</h1>
  <script>
    setTimeout(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        "<article id='rendered'>" + atob("${MARKER_B64}") + "</article>",
      );
    }, 30);
  </script>
</body></html>`;

let context: BrowserContext;
let server: http.Server;
let baseUrl: string;

test.beforeAll(async () => {
  // Build the real bundled extension so we exercise the shipped manifest + code.
  execSync("bun run build:local", { cwd: path.resolve(dir, ".."), stdio: "ignore" });

  server = http.createServer((_req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(PAGE_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://localhost:${port}/`;

  context = await chromium.launchPersistentContext("", {
    // Full Chromium build so MV3 extensions load under the new headless mode
    // (the default headless shell can't load extensions).
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
  });
});

test.afterAll(async () => {
  await context?.close();
  server?.close();
});

test("captures the client-rendered DOM a server fetch can't see", async () => {
  // The background service worker gives us the active tab id and a context to
  // run the same capture the extension performs (executeScript → outerHTML).
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker");

  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.waitForSelector("#rendered"); // client JS has run

  const tabId = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.id;
  });
  expect(typeof tabId).toBe("number");

  const captured = await sw.evaluate(async (id) => {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: id as number },
      func: () => document.documentElement.outerHTML,
    });
    return injection?.result ?? "";
  }, tabId);

  // The capture includes both the server-visible markup and the JS-injected
  // content...
  expect(captured).toContain("server-visible heading");
  expect(captured).toContain(MARKER);

  // ...whereas a plain server-side fetch of the same URL sees only the pre-JS
  // shell — the exact gap this feature closes.
  const serverFetched = await fetch(baseUrl).then((r) => r.text());
  expect(serverFetched).not.toContain(MARKER);
});
