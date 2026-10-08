import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import posthog from "posthog-js";
import { getOpenableHref } from "@/lib/link-href";

type NoteLinkOpenedVia = "menu" | "modifier_click";

/** Opens a note link in a new tab, if it's a safe, absolute URL */
export function openNoteLink({
  href,
  via,
}: {
  href: string | null | undefined;
  via: NoteLinkOpenedVia;
}): boolean {
  const openable = getOpenableHref(href);
  if (!openable) return false;
  window.open(openable, "_blank", "noopener,noreferrer");
  posthog.capture("note_link_opened", { via });
  return true;
}

/**
 * ⌘/Ctrl-click opens a link while editing. A plain click only places the
 * caret (StarterKit's link is configured with `openOnClick: false`), and the
 * link menu offers an explicit "Open" for touch. Read-only editors are left
 * alone — the browser follows the rendered `<a target="_blank">` natively.
 */
export const LinkModifierClick = Extension.create({
  name: "linkModifierClick",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("linkModifierClick"),
        props: {
          handleClick: (view, _pos, event) => {
            if (!view.editable || event.button !== 0) return false;
            if (!(event.metaKey || event.ctrlKey)) return false;
            if (!(event.target instanceof Element)) return false;
            const anchor = event.target.closest("a");
            if (!anchor || !view.dom.contains(anchor)) return false;
            // The rendered href, which the link mark already strips when unsafe
            const opened = openNoteLink({
              href: anchor.getAttribute("href"),
              via: "modifier_click",
            });
            if (opened) event.preventDefault();
            return opened;
          },
        },
      }),
    ];
  },
});
