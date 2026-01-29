export type ThemePreference = "light" | "dark" | "auto";

const THEME_SEQUENCE: ThemePreference[] = ["auto", "light", "dark"];

export function getNextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_SEQUENCE.indexOf(current);
  if (index === -1) return "auto";
  return THEME_SEQUENCE[(index + 1) % THEME_SEQUENCE.length];
}

const HTML_THEME_DATA_ATTR = "data-theme";
const HTML_THEME_PREFERENCE_ATTR = "data-theme-preference";
const HTML_COLOR_SCHEME_PROP = "color-scheme";
const HTML_DARK_MODE_CLASS = "dark";
const THEME_COOKIE_KEY = "theme";
const THEME_LOCAL_STORAGE_KEY = "abode:theme-preference";
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

export function getActiveTheme(): "light" | "dark" {
  if (!isDomAvailable()) return "light";
  return document.documentElement.getAttribute(HTML_THEME_DATA_ATTR) === "dark"
    ? "dark"
    : "light";
}

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

function parseStoredPreference(value: string | null | undefined) {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "light" || lower === "dark" || lower === "auto") {
    return lower as ThemePreference;
  }
  return null;
}

export function getStoredThemePreference(): ThemePreference | null {
  if (!isDomAvailable()) return null;
  const raw = window.localStorage.getItem(THEME_LOCAL_STORAGE_KEY);
  return parseStoredPreference(raw);
}

export function storeThemePreference(preference: ThemePreference): void {
  if (!isDomAvailable()) return;

  try {
    window.localStorage.setItem(THEME_LOCAL_STORAGE_KEY, preference);
  } catch {
    // Swallow storage exceptions (e.g. private mode)
  }

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

export function clearStoredThemePreference(): void {
  if (!isDomAvailable()) return;
  try {
    window.localStorage.removeItem(THEME_LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
  // biome-ignore lint/suspicious/noDocumentCookie: using document.cookie for compatibility
  document.cookie = `${THEME_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export type UseThemePreferenceReturn = {
  mounted: boolean;
  preference: ThemePreference;
  toggle: () => void;
};

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

  if (mediaQuery) {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", mediaListener);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(mediaListener);
    }
  }

  return () => {
    observer.disconnect();
    if (mediaQuery) {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", mediaListener);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(mediaListener);
      }
    }
  };
}
