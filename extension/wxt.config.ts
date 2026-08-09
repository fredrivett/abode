import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// A "local" build (bun run dev / build:local set WXT_ABODE_LOCAL=1) targets a
// local abode server and grants localhost host access; a normal build targets
// production. Derived here in Node so it's deterministic (not mode-inferred).
const isLocal = process.env.WXT_ABODE_LOCAL === "1";
// The local abode server's origin: Conductor sets CONDUCTOR_PORT per workspace;
// a plain checkout serves :3300.
const devBaseUrl = `http://localhost:${process.env.CONDUCTOR_PORT ?? "3300"}`;

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
    define: {
      __ABODE_LOCAL__: JSON.stringify(isLocal),
      __ABODE_DEV_BASE_URL__: JSON.stringify(devBaseUrl),
    },
  }),
  manifest: () => ({
    name: "abode",
    description: "Save the link, the photo, the tweet — to abode, in one click.",
    icons: {
      16: "/icon/16.png",
      32: "/icon/32.png",
      48: "/icon/48.png",
      128: "/icon/128.png",
    },
    // activeTab: read the current tab's URL/title only on a user gesture (icon
    // click or the save shortcut). contextMenus/storage/notifications for the
    // right-click saves, session storage, and the background "Saved" toast.
    // scripting: inject the Instagram media scraper into the active tab on a
    // user gesture (paired with activeTab, so no instagram.com host prompt).
    permissions: [
      "activeTab",
      "scripting",
      "contextMenus",
      "storage",
      "notifications",
    ],
    host_permissions: isLocal
      ? [
          "http://localhost/*",
          "https://www.abode.fyi/*",
          "https://*.supabase.co/*",
        ]
      : ["https://www.abode.fyi/*", "https://*.supabase.co/*"],
    commands: {
      "save-page": {
        suggested_key: {
          default: "Ctrl+Shift+S",
          mac: "Command+Shift+S",
        },
        description: "Save the current page to abode",
      },
    },
  }),
});
