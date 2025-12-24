/**
 * Abode Room Widget Embed Script
 *
 * Usage:
 * <div data-abode-room="room-uuid" data-type="badge" data-theme="auto"></div>
 * <script src="https://www.abode.fyi/embed.js" async></script>
 *
 * Configuration (data attributes):
 * - data-abode-room (required): Room UUID
 * - data-type: "badge" | "preview" (default: "badge")
 * - data-theme: "light" | "dark" | "auto" (default: "auto")
 * - data-size: "compact" | "standard" (default: "standard")
 * - data-items: 3 | 6 | 9 (default: 6, preview only)
 */
(() => {
  var ABODE_EMBED_VERSION = "1.0.0";

  // Detect API base from script source or default to production
  var API_BASE = (() => {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src && src.indexOf("embed.js") !== -1) {
        // Extract origin from script src
        var match = src.match(/^(https?:\/\/[^/]+)/);
        if (match) {
          return match[1];
        }
      }
    }
    return "https://www.abode.fyi";
  })();

  // Default configuration
  var DEFAULTS = {
    type: "badge",
    theme: "auto",
    size: "standard",
    items: 6,
  };

  // CSS styles for widgets (injected into shadow DOM)
  var STYLES = [
    "/* Base reset */",
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    "",
    "/* CSS Variables */",
    ":host{",
    "  --abode-bg:#ffffff;",
    "  --abode-bg-hover:#f5f5f5;",
    "  --abode-text:#171717;",
    "  --abode-text-muted:#737373;",
    "  --abode-border:#e5e5e5;",
    "  --abode-font:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;",
    "}",
    "",
    ":host([data-theme='dark']){",
    "  --abode-bg:#171717;",
    "  --abode-bg-hover:#262626;",
    "  --abode-text:#fafafa;",
    "  --abode-text-muted:#a3a3a3;",
    "  --abode-border:#404040;",
    "}",
    "",
    "/* Badge Widget */",
    ".abode-badge{",
    "  display:inline-flex;",
    "  align-items:center;",
    "  gap:0.5rem;",
    "  padding:0.5rem 0.875rem;",
    "  background:var(--abode-bg);",
    "  border:1px solid var(--abode-border);",
    "  border-radius:9999px;",
    "  color:var(--abode-text);",
    "  text-decoration:none;",
    "  font-family:var(--abode-font);",
    "  font-size:0.875rem;",
    "  line-height:1.25;",
    "  transition:background-color 0.15s,border-color 0.15s;",
    "}",
    ".abode-badge:hover{",
    "  background:var(--abode-bg-hover);",
    "}",
    ".abode-badge-emoji{font-size:1rem;}",
    ".abode-badge-name{font-weight:500;}",
    ".abode-badge-count{",
    "  color:var(--abode-text-muted);",
    "  font-size:0.75rem;",
    "}",
    "",
    "/* Badge compact size */",
    ":host([data-size='compact']) .abode-badge{",
    "  padding:0.375rem 0.625rem;",
    "  font-size:0.75rem;",
    "  gap:0.375rem;",
    "}",
    ":host([data-size='compact']) .abode-badge-emoji{font-size:0.875rem;}",
    ":host([data-size='compact']) .abode-badge-count{font-size:0.625rem;}",
    "",
    "/* Preview Widget */",
    ".abode-preview{",
    "  display:flex;",
    "  flex-direction:column;",
    "  gap:0.75rem;",
    "  max-width:400px;",
    "  background:var(--abode-bg);",
    "  border:1px solid var(--abode-border);",
    "  border-radius:0.75rem;",
    "  padding:1rem;",
    "  font-family:var(--abode-font);",
    "}",
    ".abode-preview-header{",
    "  display:flex;",
    "  align-items:center;",
    "  gap:0.75rem;",
    "  text-decoration:none;",
    "  color:var(--abode-text);",
    "}",
    ".abode-preview-header:hover .abode-preview-name{text-decoration:underline;}",
    ".abode-preview-emoji{font-size:1.5rem;}",
    ".abode-preview-info{",
    "  display:flex;",
    "  flex-direction:column;",
    "  gap:0.125rem;",
    "  min-width:0;",
    "}",
    ".abode-preview-name{",
    "  font-weight:600;",
    "  font-size:1rem;",
    "  line-height:1.25;",
    "  white-space:nowrap;",
    "  overflow:hidden;",
    "  text-overflow:ellipsis;",
    "}",
    ".abode-preview-meta{",
    "  color:var(--abode-text-muted);",
    "  font-size:0.75rem;",
    "  line-height:1.25;",
    "}",
    ".abode-preview-grid{",
    "  display:grid;",
    "  gap:0.5rem;",
    "}",
    ".abode-preview-grid[data-items='3']{grid-template-columns:repeat(3,1fr);}",
    ".abode-preview-grid[data-items='6']{grid-template-columns:repeat(3,1fr);}",
    ".abode-preview-grid[data-items='9']{grid-template-columns:repeat(3,1fr);}",
    ".abode-preview-item{",
    "  display:block;",
    "  text-decoration:none;",
    "  border-radius:0.375rem;",
    "  overflow:hidden;",
    "  background:var(--abode-border);",
    "}",
    ".abode-preview-item img{",
    "  display:block;",
    "  width:100%;",
    "  aspect-ratio:1;",
    "  object-fit:cover;",
    "}",
    ".abode-preview-empty{",
    "  aspect-ratio:1;",
    "  background:var(--abode-border);",
    "}",
    "",
    "/* Preview compact size */",
    ":host([data-size='compact']) .abode-preview{",
    "  max-width:300px;",
    "  padding:0.75rem;",
    "  gap:0.5rem;",
    "}",
    ":host([data-size='compact']) .abode-preview-emoji{font-size:1.25rem;}",
    ":host([data-size='compact']) .abode-preview-name{font-size:0.875rem;}",
    ":host([data-size='compact']) .abode-preview-meta{font-size:0.625rem;}",
    ":host([data-size='compact']) .abode-preview-grid{gap:0.375rem;}",
    "",
    "/* Loading state */",
    ".abode-loading{",
    "  display:inline-flex;",
    "  align-items:center;",
    "  gap:0.5rem;",
    "  padding:0.5rem 0.875rem;",
    "  color:var(--abode-text-muted);",
    "  font-family:var(--abode-font);",
    "  font-size:0.875rem;",
    "}",
    ".abode-loading-spinner{",
    "  width:1rem;",
    "  height:1rem;",
    "  border:2px solid var(--abode-border);",
    "  border-top-color:var(--abode-text-muted);",
    "  border-radius:50%;",
    "  animation:abode-spin 0.8s linear infinite;",
    "}",
    "@keyframes abode-spin{to{transform:rotate(360deg);}}",
    "",
    "/* Error state */",
    ".abode-error{",
    "  display:inline-flex;",
    "  align-items:center;",
    "  padding:0.5rem 0.875rem;",
    "  color:var(--abode-text-muted);",
    "  font-family:var(--abode-font);",
    "  font-size:0.75rem;",
    "}",
  ].join("\n");

  /**
   * Get preferred theme based on system settings
   */
  function getPreferredTheme() {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }

  /**
   * Parse configuration from data attributes
   */
  function parseConfig(container) {
    var type = container.getAttribute("data-type") || DEFAULTS.type;
    var theme = container.getAttribute("data-theme") || DEFAULTS.theme;
    var size = container.getAttribute("data-size") || DEFAULTS.size;
    var items =
      parseInt(container.getAttribute("data-items"), 10) || DEFAULTS.items;

    // Validate values
    if (["badge", "preview"].indexOf(type) === -1) type = DEFAULTS.type;
    if (["light", "dark", "auto"].indexOf(theme) === -1) theme = DEFAULTS.theme;
    if (["compact", "standard"].indexOf(size) === -1) size = DEFAULTS.size;
    if ([3, 6, 9].indexOf(items) === -1) items = DEFAULTS.items;

    // Resolve auto theme
    var resolvedTheme = theme === "auto" ? getPreferredTheme() : theme;

    return {
      type: type,
      theme: resolvedTheme,
      size: size,
      items: items,
    };
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Fetch room data from API
   */
  function fetchRoomData(roomId, itemLimit) {
    var url =
      API_BASE + "/api/v1/embed/rooms/" + roomId + "?limit=" + itemLimit;

    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load room: " + response.status);
      }
      return response.json();
    });
  }

  /**
   * Create loading HTML
   */
  function createLoadingHTML() {
    return [
      "<style>" + STYLES + "</style>",
      '<div class="abode-loading">',
      '  <div class="abode-loading-spinner"></div>',
      "  <span>Loading...</span>",
      "</div>",
    ].join("");
  }

  /**
   * Create error HTML
   */
  function createErrorHTML() {
    return [
      "<style>" + STYLES + "</style>",
      '<div class="abode-error">Failed to load room</div>',
    ].join("");
  }

  /**
   * Create badge widget HTML
   */
  function createBadgeHTML(data) {
    var emoji = data.room.emoji || "\ud83d\udcc1"; // folder emoji fallback
    var name = escapeHtml(data.room.name);
    var count = data.room.itemCount;
    var url = escapeHtml(data.roomUrl);

    return [
      "<style>" + STYLES + "</style>",
      '<a class="abode-badge" href="' +
        url +
        '" target="_blank" rel="noopener noreferrer">',
      '  <span class="abode-badge-emoji">' + emoji + "</span>",
      '  <span class="abode-badge-name">' + name + "</span>",
      '  <span class="abode-badge-count">' + count + " items</span>",
      "</a>",
    ].join("");
  }

  /**
   * Create preview widget HTML
   */
  function createPreviewHTML(data, config) {
    var emoji = data.room.emoji || "\ud83d\udcc1";
    var name = escapeHtml(data.room.name);
    var username = escapeHtml(data.owner.username);
    var count = data.room.itemCount;
    var url = escapeHtml(data.roomUrl);
    var items = data.items;

    // Build item grid
    var gridItems = [];
    for (var i = 0; i < config.items; i++) {
      if (items[i] && items[i].imageUrl) {
        var imgUrl = API_BASE + items[i].imageUrl;
        var title = escapeHtml(items[i].title || "");
        gridItems.push(
          '<a class="abode-preview-item" href="' +
            url +
            '" target="_blank" rel="noopener noreferrer">' +
            '<img src="' +
            imgUrl +
            '" alt="' +
            title +
            '" loading="lazy" />' +
            "</a>",
        );
      } else {
        gridItems.push(
          '<div class="abode-preview-item"><div class="abode-preview-empty"></div></div>',
        );
      }
    }

    return [
      "<style>" + STYLES + "</style>",
      '<div class="abode-preview">',
      '  <a class="abode-preview-header" href="' +
        url +
        '" target="_blank" rel="noopener noreferrer">',
      '    <span class="abode-preview-emoji">' + emoji + "</span>",
      '    <span class="abode-preview-info">',
      '      <span class="abode-preview-name">' + name + "</span>",
      '      <span class="abode-preview-meta">by @' +
        username +
        " &middot; " +
        count +
        " items</span>",
      "    </span>",
      "  </a>",
      '  <div class="abode-preview-grid" data-items="' + config.items + '">',
      "    " + gridItems.join("\n    "),
      "  </div>",
      "</div>",
    ].join("\n");
  }

  /**
   * Render widget into container
   */
  function renderWidget(container) {
    var roomId = container.getAttribute("data-abode-room");
    if (!roomId) {
      console.warn("Abode widget: Missing data-abode-room attribute");
      return;
    }

    var config = parseConfig(container);

    // Set theme attribute on container for CSS targeting
    container.setAttribute("data-theme", config.theme);
    container.setAttribute("data-size", config.size);

    // Create shadow DOM
    var shadow;
    try {
      shadow = container.attachShadow({ mode: "closed" });
    } catch (e) {
      // Shadow DOM might already be attached or not supported
      console.warn("Abode widget: Could not attach shadow DOM", e);
      return;
    }

    // Show loading state
    shadow.innerHTML = createLoadingHTML();

    // Fetch and render
    fetchRoomData(roomId, config.items)
      .then((data) => {
        if (config.type === "preview") {
          shadow.innerHTML = createPreviewHTML(data, config);
        } else {
          shadow.innerHTML = createBadgeHTML(data);
        }
      })
      .catch((error) => {
        console.error("Abode widget error:", error);
        shadow.innerHTML = createErrorHTML();
      });
  }

  /**
   * Initialize all widgets on page
   */
  function init() {
    var containers = document.querySelectorAll("[data-abode-room]");
    for (var i = 0; i < containers.length; i++) {
      renderWidget(containers[i]);
    }
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose version for debugging
  window.ABODE_EMBED_VERSION = ABODE_EMBED_VERSION;
})();
