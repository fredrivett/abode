import {
  NotSignedInError,
  saveInstagramScrape,
  saveNote,
  saveUrl,
} from "@/lib/api";
import { scrapeInstagramTab } from "@/lib/instagram-scrape";
import { defineBackground } from "#imports";
import { browser } from "wxt/browser";

const MENU = {
  page: "abode-save-page",
  link: "abode-save-link",
  image: "abode-save-image",
  selection: "abode-save-selection",
} as const;

export default defineBackground(() => {
  // Right-click menus. Rebuilt on install/update so titles stay current.
  browser.runtime.onInstalled.addListener(async () => {
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({
      id: MENU.page,
      title: "Save page to abode",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: MENU.link,
      title: "Save link to abode",
      contexts: ["link"],
    });
    browser.contextMenus.create({
      id: MENU.image,
      title: "Save image to abode",
      contexts: ["image"],
    });
    browser.contextMenus.create({
      id: MENU.selection,
      title: "Save selection to abode",
      contexts: ["selection"],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      switch (info.menuItemId) {
        case MENU.page:
          await saveActivePage({ id: tab?.id, url: info.pageUrl ?? tab?.url });
          break;
        case MENU.link:
          await saveUrl(info.linkUrl ?? "");
          break;
        case MENU.image:
          await saveUrl(info.srcUrl ?? "");
          break;
        case MENU.selection:
          await saveNote(info.selectionText ?? "", tab?.title ?? undefined);
          break;
        default:
          return;
      }
      await onSaved();
    } catch (error) {
      await onError(error);
    }
  });

  // Keyboard shortcut → save the active tab's page.
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "save-page") return;
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.url) return;
      await saveActivePage(tab);
      await onSaved();
    } catch (error) {
      await onError(error);
    }
  });
});

/**
 * Save the current page. An Instagram post is scraped in-page (activeTab) and
 * saved with its full media; anything else — or a failed/empty scrape — falls
 * back to a plain URL save.
 */
async function saveActivePage(tab: {
  id?: number;
  url?: string;
}): Promise<void> {
  const url = tab.url;
  if (!url) return;
  const scrape = tab.id != null ? await scrapeInstagramTab(tab.id, url) : null;
  if (scrape) {
    await saveInstagramScrape(url, scrape);
  } else {
    await saveUrl(url);
  }
}

async function onSaved(): Promise<void> {
  await flashBadge("✓", "#16a34a");
  notify("Saved to abode", "We'll sort it for you.");
}

async function onError(error: unknown): Promise<void> {
  await flashBadge("!", "#dc2626");
  if (error instanceof NotSignedInError) {
    notify(
      "Sign in to abode",
      "Open the abode extension to sign in, then try again.",
    );
    return;
  }
  const message = error instanceof Error ? error.message : "Something went wrong";
  notify("Couldn't save", message);
}

async function flashBadge(text: string, color: string): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
  // Best-effort clear; the badge also resets on the next event.
  setTimeout(() => {
    void browser.action.setBadgeText({ text: "" });
  }, 3000);
}

function notify(title: string, message: string): void {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("/icon/128.png"),
    title,
    message,
  });
}
