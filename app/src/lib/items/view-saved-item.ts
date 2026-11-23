import posthog from "posthog-js";
import { ROUTES } from "@/lib/routes";
import { withOpenItem } from "./item-dialog-url";

/**
 * The "View" action for a save's success toast: opens the new item's dialog.
 * The item may be off screen or missing from the grid (search results rank it
 * elsewhere or leave it out), so this is the one way to it every save has.
 */
export function viewSavedItemAction(itemId: string) {
  return {
    label: "View",
    onClick: () => {
      posthog.capture("saved_item_viewed_from_toast");
      const { pathname, search } = window.location;
      if (pathname.startsWith(ROUTES.DASHBOARD)) {
        // The dashboard's dialog provider follows the URL, and keeps the search
        window.history.pushState(null, "", `?${withOpenItem(search, itemId)}`);
        return;
      }
      // Saves made elsewhere navigate to the dashboard, so this is a rare race
      window.location.assign(`${ROUTES.DASHBOARD}?${withOpenItem("", itemId)}`);
    },
  };
}
