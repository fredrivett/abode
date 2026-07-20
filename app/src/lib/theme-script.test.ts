import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyThemePreference,
  THEME_COOKIE_KEY,
  type ThemePreference,
} from "@/lib/theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

function readRootState() {
  const root = document.documentElement;
  return {
    isDark: root.classList.contains("dark"),
    dataTheme: root.getAttribute("data-theme"),
    preference: root.getAttribute("data-theme-preference"),
    colorScheme: root.style.getPropertyValue("color-scheme"),
  };
}

function resetRoot() {
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-preference");
  document.documentElement.style.removeProperty("color-scheme");
}

function setCookie(value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: writing the theme cookie the script reads
  document.cookie = value;
}

function setThemeCookie(value: ThemePreference) {
  setCookie(`${THEME_COOKIE_KEY}=${value}; path=/`);
}

function clearThemeCookie() {
  setCookie(`${THEME_COOKIE_KEY}=; path=/; max-age=0`);
}

/**
 * Runs the blocking theme bootstrap script the way the browser would (a bare
 * IIFE against the ambient document/window) and returns the resulting
 * document-root state.
 */
function runThemeScript() {
  new Function(THEME_INIT_SCRIPT)();
  return readRootState();
}

function setSystemPrefersDark(matches: boolean) {
  window.matchMedia = (query: string) => ({
    matches: matches && query.includes("prefers-color-scheme: dark"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

describe("THEME_INIT_SCRIPT", () => {
  beforeEach(() => {
    resetRoot();
    clearThemeCookie();
    setSystemPrefersDark(false);
  });

  afterEach(() => {
    clearThemeCookie();
  });

  it("applies dark when the theme cookie is dark", () => {
    setThemeCookie("dark");
    const state = runThemeScript();
    expect(state).toEqual({
      isDark: true,
      dataTheme: "dark",
      preference: "dark",
      colorScheme: "dark",
    });
  });

  it("applies light when the theme cookie is light", () => {
    setThemeCookie("light");
    const state = runThemeScript();
    expect(state).toEqual({
      isDark: false,
      dataTheme: "light",
      preference: "light",
      colorScheme: "light",
    });
  });

  it("resolves auto to the system preference (dark)", () => {
    setSystemPrefersDark(true);
    setThemeCookie("auto");
    const state = runThemeScript();
    expect(state.isDark).toBe(true);
    expect(state.dataTheme).toBe("dark");
    expect(state.preference).toBe("auto");
  });

  it("resolves auto to the system preference (light)", () => {
    setSystemPrefersDark(false);
    setThemeCookie("auto");
    const state = runThemeScript();
    expect(state.isDark).toBe(false);
    expect(state.dataTheme).toBe("light");
    expect(state.preference).toBe("auto");
  });

  it("defaults to auto (light system) with no cookie", () => {
    const state = runThemeScript();
    expect(state.isDark).toBe(false);
    expect(state.preference).toBe("auto");
    expect(state.dataTheme).toBe("light");
  });

  it("ignores invalid cookie values and defaults to auto", () => {
    setThemeCookie("purple" as ThemePreference);
    const state = runThemeScript();
    expect(state.preference).toBe("auto");
  });

  it("does not abort on a malformed (undecodable) cookie value", () => {
    // A bare "%" is invalid percent-encoding — decodeURIComponent would throw
    // and, inside the script's try/catch, abort the whole bootstrap leaving no
    // theme applied. Reading the raw value must instead fall through to auto.
    setCookie(`${THEME_COOKIE_KEY}=%; path=/`);
    const state = runThemeScript();
    expect(state.preference).toBe("auto");
    expect(state.dataTheme).toBe("light");
  });
});

/**
 * The inline bootstrap necessarily restates `applyThemePreference`'s logic as a
 * string (it must run before any bundle loads, so it can't call the function).
 * These cases pin the two implementations together: for the same preference and
 * system state they must leave the document root in identical states, so the
 * duplicated logic can't silently drift.
 */
describe("THEME_INIT_SCRIPT matches applyThemePreference", () => {
  const preferences: ThemePreference[] = ["light", "dark", "auto"];

  beforeEach(() => {
    clearThemeCookie();
  });

  for (const preference of preferences) {
    for (const systemDark of [true, false]) {
      it(`agrees for preference="${preference}", system dark=${systemDark}`, () => {
        setSystemPrefersDark(systemDark);

        resetRoot();
        setThemeCookie(preference);
        const scriptState = runThemeScript();

        resetRoot();
        applyThemePreference(preference);
        const runtimeState = readRootState();

        expect(scriptState).toEqual(runtimeState);
      });
    }
  }
});
