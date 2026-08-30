import { subscribeMediaQuery } from "@/lib/media-query";

export type ThemePreference = "light" | "dark" | "auto";

const THEME_SEQUENCE: ThemePreference[] = ["auto", "light", "dark"];

/**
 * Returns the next theme preference in the cycle: auto -> light -> dark -> auto.
 */
export function getNextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_SEQUENCE.indexOf(current);
  if (index === -1) return "auto";
  return THEME_SEQUENCE[(index + 1) % THEME_SEQUENCE.length];
}

export const HTML_THEME_DATA_ATTR = "data-theme";
export const HTML_THEME_PREFERENCE_ATTR = "data-theme-preference";
export const HTML_COLOR_SCHEME_PROP = "color-scheme";
export const HTML_DARK_MODE_CLASS = "dark";
export const THEME_COOKIE_KEY = "theme";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function isDomAvailable(): boolean {
  return typeof document !== "undefined" && typeof window !== "undefined";
}

function resolveMode(preference: ThemePreference): "light" | "dark" {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  return mediaQuery?.matches ? "dark" : "light";
}

/**
 * Applies a theme preference to the document root element.
 *
 * Sets `data-theme`, `data-theme-preference`, the `color-scheme` CSS property,
 * and toggles the `dark` class. When preference is `"auto"`, resolves the
 * effective mode from the system `prefers-color-scheme` media query.
 */
export function applyThemePreference(preference: ThemePreference): void {
  if (!isDomAvailable()) return;

  const root = document.documentElement;
  root.setAttribute(HTML_THEME_PREFERENCE_ATTR, preference);

  const mode = resolveMode(preference);
  if (mode === "dark") {
    root.classList.add(HTML_DARK_MODE_CLASS);
  } else {
    root.classList.remove(HTML_DARK_MODE_CLASS);
  }

  root.setAttribute(HTML_THEME_DATA_ATTR, mode);
  root.style.setProperty(HTML_COLOR_SCHEME_PROP, mode);
}

/**
 * Reads the currently active theme (`"light"` or `"dark"`) from the document root.
 *
 * Defaults to `"light"` on the server or when the attribute is absent.
 */
export function getActiveTheme(): "light" | "dark" {
  if (!isDomAvailable()) return "light";
  return document.documentElement.getAttribute(HTML_THEME_DATA_ATTR) === "dark"
    ? "dark"
    : "light";
}

/**
 * Reads the current theme preference from the DOM attribute, falling back
 * to the theme cookie. Returns `"auto"` on the server or when no preference
 * is found.
 */
export function getCurrentPreference(): ThemePreference {
  if (!isDomAvailable()) return "auto";

  const attr = document.documentElement.getAttribute(
    HTML_THEME_PREFERENCE_ATTR,
  );
  if (attr === "light" || attr === "dark" || attr === "auto") {
    return attr;
  }

  const cookieMatch = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${THEME_COOKIE_KEY}=`));

  if (cookieMatch) {
    const value = cookieMatch.split("=")[1]?.toLowerCase();
    if (value === "light" || value === "dark" || value === "auto") {
      return value;
    }
  }

  return "auto";
}

/**
 * Persists the theme preference to a `theme` cookie.
 *
 * The cookie is the single source of truth: it is readable both client-side
 * (by the theme bootstrap script and runtime) and, unlike localStorage, by the
 * server. SameSite=Lax with a one-year expiry.
 */
export function storeThemePreference(preference: ThemePreference): void {
  if (!isDomAvailable()) return;

  const cookieValue = [
    `${THEME_COOKIE_KEY}=${preference}`,
    "path=/",
    `max-age=${ONE_YEAR_IN_SECONDS}`,
    "SameSite=Lax",
  ];

  if (window.location.protocol === "https:") {
    cookieValue.push("Secure");
  }

  // biome-ignore lint/suspicious/noDocumentCookie: using document.cookie for compatibility
  document.cookie = cookieValue.join("; ");
}

/**
 * Removes the persisted theme preference by clearing the `theme` cookie.
 */
export function clearStoredThemePreference(): void {
  if (!isDomAvailable()) return;
  // biome-ignore lint/suspicious/noDocumentCookie: using document.cookie for compatibility
  document.cookie = `${THEME_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export type UseThemePreferenceReturn = {
  mounted: boolean;
  preference: ThemePreference;
  toggle: () => void;
};

/**
 * Subscribes to theme changes via a MutationObserver on the document root
 * and the `prefers-color-scheme` media query.
 *
 * Calls the callback immediately with the current state, then again whenever
 * the active theme changes. Returns an unsubscribe function.
 */
export function subscribeToThemeChanges(
  callback: (isDark: boolean) => void,
): () => void {
  if (!isDomAvailable()) return () => {};

  const root = document.documentElement;
  const notify = () => callback(getActiveTheme() === "dark");

  notify();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        (mutation.attributeName === HTML_THEME_DATA_ATTR ||
          mutation.attributeName === "class")
      ) {
        notify();
        break;
      }
    }
  });

  observer.observe(root, {
    attributes: true,
    attributeFilter: ["class", HTML_THEME_DATA_ATTR],
  });

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  const mediaListener = () => {
    if (root.getAttribute(HTML_THEME_PREFERENCE_ATTR) === "auto") {
      applyThemePreference("auto");
      notify();
    }
  };

  const unsubscribeMedia = mediaQuery
    ? subscribeMediaQuery(mediaQuery, mediaListener)
    : undefined;

  return () => {
    observer.disconnect();
    unsubscribeMedia?.();
  };
}
