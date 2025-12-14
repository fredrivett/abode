import { beforeEach, describe, expect, test } from "vitest";
import {
  applyThemePreference,
  clearStoredThemePreference,
  getActiveTheme,
  getCurrentPreference,
  getStoredThemePreference,
  storeThemePreference,
} from "./theme";

describe("theme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preference");
    document.documentElement.className = "";
    document.documentElement.style.cssText = "";
    window.localStorage.clear();
    // biome-ignore lint/suspicious/noDocumentCookie: test needs cookie state
    document.cookie = "theme=; path=/; max-age=0";
  });

  test("applyThemePreference updates DOM attributes and class", () => {
    applyThemePreference("dark");
    expect(getActiveTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme-preference")).toBe(
      "dark",
    );

    applyThemePreference("light");
    expect(getActiveTheme()).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  test("getCurrentPreference prefers the DOM attribute", () => {
    document.documentElement.setAttribute("data-theme-preference", "light");
    // biome-ignore lint/suspicious/noDocumentCookie: test needs cookie state
    document.cookie = "theme=dark; path=/";
    expect(getCurrentPreference()).toBe("light");
  });

  test("getCurrentPreference falls back to cookie", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: test needs cookie state
    document.cookie = "theme=dark; path=/";
    expect(getCurrentPreference()).toBe("dark");
  });

  test("getStoredThemePreference reads localStorage and validates values", () => {
    expect(getStoredThemePreference()).toBeNull();

    window.localStorage.setItem("abode:theme-preference", "dark");
    expect(getStoredThemePreference()).toBe("dark");

    window.localStorage.setItem("abode:theme-preference", "nope");
    expect(getStoredThemePreference()).toBeNull();
  });

  test("storeThemePreference persists localStorage and cookie", () => {
    storeThemePreference("auto");
    expect(window.localStorage.getItem("abode:theme-preference")).toBe("auto");
    expect(document.cookie).toContain("theme=auto");
  });

  test("clearStoredThemePreference removes stored preference", () => {
    storeThemePreference("dark");
    clearStoredThemePreference();
    expect(window.localStorage.getItem("abode:theme-preference")).toBeNull();
    expect(document.cookie).not.toContain("theme=dark");
  });
});
