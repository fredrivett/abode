import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  // Function form so .env is loaded before the manifest is built (host
  // permissions differ by mode — no localhost in a store build).
  manifest: ({ mode }) => ({
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
    permissions: ["activeTab", "contextMenus", "storage", "notifications"],
    host_permissions:
      mode === "production"
        ? ["https://www.abode.fyi/*", "https://*.supabase.co/*"]
        : [
            "http://localhost/*",
            "https://www.abode.fyi/*",
            "https://*.supabase.co/*",
          ],
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
