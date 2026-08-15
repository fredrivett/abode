import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// A "local" build (bun run dev / build:local set WXT_ABODE_LOCAL=1) targets a
// local abode server and grants localhost host access; a normal build targets
// production. Derived here in Node so it's deterministic (not mode-inferred).
const isLocal = process.env.WXT_ABODE_LOCAL === "1";
// The local abode server's origin: Conductor sets CONDUCTOR_PORT per workspace;
// a plain checkout serves :3300.
const devBaseUrl = `http://localhost:${process.env.CONDUCTOR_PORT ?? "3300"}`;

// Build identity, so a running extension can tell whether it's stale. In CI both
// come from GitHub's default env vars (set in every step, no workflow wiring):
//   - number = GITHUB_RUN_NUMBER — the Extension Build workflow's monotonic run
//     counter. The popup compares it against the latest main run to answer
//     "am I behind?" (see lib/updates.ts). 0 outside CI (a local build).
//   - sha = the commit the build came from, for traceability back to a PR.
// Baked into the JS (defines below) and the manifest (version_name, shown in
// chrome://extensions).
const buildNumber = Number.parseInt(process.env.GITHUB_RUN_NUMBER ?? "0", 10) || 0;
const buildSha = resolveBuildSha();

function resolveBuildSha(): string {
  const ciSha = process.env.GITHUB_SHA;
  if (ciSha) return ciSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function readPkgVersion(): string {
  const raw: unknown = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8"),
  );
  if (
    typeof raw === "object" &&
    raw !== null &&
    "version" in raw &&
    typeof raw.version === "string"
  ) {
    return raw.version;
  }
  return "0.0.0";
}

// e.g. "0.1.0 · build 234 · abc1234" (CI) or "0.1.0 · dev · abc1234" (local).
const versionName = `${readPkgVersion()} · ${
  buildNumber > 0 ? `build ${buildNumber}` : "dev"
} · ${buildSha}`;

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
    define: {
      __ABODE_LOCAL__: JSON.stringify(isLocal),
      __ABODE_DEV_BASE_URL__: JSON.stringify(devBaseUrl),
      __ABODE_BUILD_NUMBER__: JSON.stringify(buildNumber),
      __ABODE_BUILD_SHA__: JSON.stringify(buildSha),
    },
  }),
  manifest: () => ({
    name: "abode",
    description: "Save the link, the photo, the tweet — to abode, in one click.",
    // Display-only build identity (chrome://extensions). The numeric `version`
    // stays pure semver (WXT derives it from package.json).
    version_name: versionName,
    icons: {
      16: "/icon/16.png",
      32: "/icon/32.png",
      48: "/icon/48.png",
      128: "/icon/128.png",
    },
    // activeTab: read the current tab's URL/title only on a user gesture (icon
    // click or the save shortcut). scripting: run a one-shot script in that same
    // active tab to capture its rendered DOM on a page save (paired with
    // activeTab, so no broad host-permission prompt). contextMenus/storage/
    // notifications for the right-click saves, session storage, and the
    // background "Saved" toast.
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
