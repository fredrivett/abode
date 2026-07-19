import {
  HTML_COLOR_SCHEME_PROP,
  HTML_DARK_MODE_CLASS,
  HTML_THEME_DATA_ATTR,
  HTML_THEME_PREFERENCE_ATTR,
  THEME_COOKIE_KEY,
} from "@/lib/theme";

/**
 * A synchronous, blocking script that applies the persisted theme to the
 * document root before first paint.
 *
 * It mirrors `applyThemePreference` (reading the same `theme` cookie the
 * runtime writes, falling back to "auto") so every route — including ones that
 * render no header/toggle, e.g. the `(auth)` pages — gets the correct theme
 * with no flash of the wrong mode. It reads the same constants the runtime uses
 * so the two can't drift.
 *
 * Injected via `dangerouslySetInnerHTML`; the string is built from static
 * constants only (no user input), so it is safe to inline.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var d=document.documentElement;
var pref=null;
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE_KEY}=([^;]*)/);
if(m){var c=decodeURIComponent(m[1]).toLowerCase();if(c==="light"||c==="dark"||c==="auto"){pref=c;}}
if(!pref){pref="auto";}
var mode=pref;
if(pref==="auto"){mode=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";}
d.setAttribute(${JSON.stringify(HTML_THEME_PREFERENCE_ATTR)},pref);
if(mode==="dark"){d.classList.add(${JSON.stringify(HTML_DARK_MODE_CLASS)});}else{d.classList.remove(${JSON.stringify(HTML_DARK_MODE_CLASS)});}
d.setAttribute(${JSON.stringify(HTML_THEME_DATA_ATTR)},mode);
d.style.setProperty(${JSON.stringify(HTML_COLOR_SCHEME_PROP)},mode);
}catch(e){}})();`;
