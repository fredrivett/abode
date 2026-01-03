/**
 * Abode Room Widget Embed Script
 *
 * Usage:
 * <span data-abode-room="room-uuid" data-type="badge" data-theme="auto"></span>
 * <script src="https://www.abode.fyi/embed.js" async></script>
 *
 * Configuration (data attributes):
 * - data-abode-room (required): Room UUID
 * - data-type: "badge" | "preview" (default: "badge")
 * - data-theme: "light" | "dark" | "auto" (default: "auto")
 * - data-show-emoji: "true" | "false" (default: "true")
 * - data-text: Custom link text (badge only, overrides room name)
 * - data-room-json: Pre-loaded room data JSON (skips API fetch if provided)
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
    items: 12,
    showFilters: true,
    showEmoji: true,
  };

  // Filter type icons for display
  var FILTER_ICONS = {
    type: "\u2733\ufe0f",
    tag: "\ud83c\udff7\ufe0f",
    object: "\ud83d\udce6",
    color: "\ud83c\udfa8",
    source: "\ud83d\udd17",
    date: "\ud83d\udcc5",
    location: "\ud83d\udccd",
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
    "  gap:0.375em;",
    "  margin:-0.25em 0;",
    "  padding:0.175em 0.625em;",
    "  background:var(--abode-bg);",
    "  border:1px solid var(--abode-border);",
    "  border-radius:999px;",
    "  color:var(--abode-text);",
    "  text-decoration:none;",
    "  font-size:0.95em;",
    "  line-height:1.25;",
    "  vertical-align:middle;",
    "  transition:background-color 0.15s,border-color 0.15s;",
    "}",
    ".abode-badge:hover{",
    "  background:var(--abode-bg-hover);",
    "}",
    ".abode-badge-emoji{font-size:1.125em;}",
    ".abode-badge-name{",
    "  font-family:ui-serif,Georgia,Cambria,'Times New Roman',Times,serif;",
    "  font-weight:500;",
    "}",
    "",
    "/* Preview Widget */",
    ".abode-preview{",
    "  display:flex;",
    "  flex-direction:column;",
    "  gap:0.75em;",
    "  width:100%;",
    "  background:var(--abode-bg);",
    "  border:1px solid var(--abode-border);",
    "  border-radius:0.75em;",
    "  padding:1em;",
    "  font-family:var(--abode-font);",
    "}",
    ".abode-preview-header-row{",
    "  display:flex;",
    "  align-items:flex-start;",
    "  justify-content:space-between;",
    "  gap:0.75em;",
    "}",
    ".abode-preview-header{",
    "  display:flex;",
    "  align-items:flex-start;",
    "  gap:0.75em;",
    "  flex:1;",
    "  min-width:0;",
    "}",
    ".abode-preview-emoji{font-size:1.5em;line-height:1;cursor:default;}",
    ".abode-preview-info{",
    "  display:flex;",
    "  flex-direction:column;",
    "  gap:0.125em;",
    "  min-width:0;",
    "}",
    ".abode-preview-name{",
    "  display:inline-block;",
    "  font-weight:600;",
    "  font-size:1em;",
    "  line-height:1.25;",
    "  color:var(--abode-text);",
    "  text-decoration:none;",
    "}",
    ".abode-preview-name:hover{text-decoration:underline;}",
    ".abode-preview-meta{",
    "  color:var(--abode-text-muted);",
    "  font-size:0.75em;",
    "  line-height:1.25;",
    "  cursor:default;",
    "}",
    ".abode-preview-username{",
    "  color:var(--abode-text-muted);",
    "  text-decoration:none;",
    "}",
    ".abode-preview-username:hover{text-decoration:underline;}",
    ".abode-preview-grid-link{",
    "  display:block;",
    "  text-decoration:none;",
    "}",
    ".abode-preview-grid-container{",
    "  position:relative;",
    "  max-height:360px;",
    "  overflow:hidden;",
    "}",
    ".abode-preview-grid{",
    "  column-count:3;",
    "  column-gap:0.5em;",
    "}",
    ".abode-preview-fade{",
    "  position:absolute;",
    "  bottom:0;",
    "  left:0;",
    "  right:0;",
    "  height:160px;",
    "  background:linear-gradient(to bottom, transparent, var(--abode-bg));",
    "  pointer-events:none;",
    "}",
    ".abode-preview-item{",
    "  display:block;",
    "  text-decoration:none;",
    "  border-radius:0.375em;",
    "  overflow:hidden;",
    "  background:var(--abode-border);",
    "  break-inside:avoid;",
    "  margin-bottom:0.5em;",
    "}",
    ".abode-preview-item img{",
    "  display:block;",
    "  width:100%;",
    "  height:auto;",
    "}",
    ".abode-preview-empty{",
    "  aspect-ratio:1;",
    "  background:var(--abode-border);",
    "}",
    "",
    "/* Right Column (Logo) */",
    ".abode-preview-right{",
    "  display:flex;",
    "  flex-direction:column;",
    "  align-items:flex-end;",
    "  gap:0.5em;",
    "  flex-shrink:0;",
    "}",
    ".abode-logo{",
    "  opacity:0.5;",
    "  transition:opacity 0.15s;",
    "}",
    ".abode-logo:hover{opacity:1;}",
    ".abode-logo svg{",
    "  height:0.75em;",
    "  width:auto;",
    "  display:block;",
    "}",
    "",
    "/* Filters */",
    ".abode-filters{",
    "  display:flex;",
    "  flex-wrap:wrap;",
    "  gap:0.25em;",
    "  margin-top:0.25em;",
    "}",
    ".abode-filter{",
    "  display:inline-flex;",
    "  align-items:center;",
    "  padding:0.125em 0.375em;",
    "  border:1px solid var(--abode-border);",
    "  border-radius:9999px;",
    "  font-size:0.625em;",
    "  color:var(--abode-text-muted);",
    "  background:rgba(0,0,0,0.03);",
    "  cursor:default;",
    "}",
    ":host([data-theme='dark']) .abode-filter{background:rgba(255,255,255,0.08);}",
    "",
    "/* Loading state */",
    ".abode-loading{",
    "  display:inline-flex;",
    "  align-items:center;",
    "  gap:0.5em;",
    "  padding:0.5em 0.875em;",
    "  color:var(--abode-text-muted);",
    "  font-family:var(--abode-font);",
    "  font-size:0.875em;",
    "}",
    ".abode-loading-spinner{",
    "  width:1em;",
    "  height:1em;",
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
    "  padding:0.5em 0.875em;",
    "  color:var(--abode-text-muted);",
    "  font-family:var(--abode-font);",
    "  font-size:0.75em;",
    "}",
  ].join("\n");

  /**
   * Detect theme from page context (classes, attributes, styles)
   */
  function detectPageTheme() {
    var html = document.documentElement;

    // Check common class-based patterns
    if (html.classList.contains("dark")) return "dark";
    if (html.classList.contains("light")) return "light";

    // Check data-theme attribute (used by many theme systems)
    var dataTheme = html.getAttribute("data-theme");
    if (dataTheme === "dark" || dataTheme === "light") return dataTheme;

    // Check data-mode attribute (another common pattern)
    var dataMode = html.getAttribute("data-mode");
    if (dataMode === "dark" || dataMode === "light") return dataMode;

    // Check color-scheme style property
    var colorScheme = html.style.colorScheme;
    if (colorScheme === "dark" || colorScheme === "light") return colorScheme;

    return null;
  }

  /**
   * Get preferred theme based on page context, then system settings
   */
  function getPreferredTheme() {
    // First try to detect from page context
    var pageTheme = detectPageTheme();
    if (pageTheme) return pageTheme;

    // Fall back to OS preference
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }

  // Track widgets using auto theme for live updates
  var autoThemeWidgets = [];

  /**
   * Update theme on all auto-theme widgets
   */
  function updateAutoThemeWidgets() {
    var newTheme = getPreferredTheme();
    for (var i = 0; i < autoThemeWidgets.length; i++) {
      var container = autoThemeWidgets[i];
      if (container.isConnected) {
        container.setAttribute("data-theme", newTheme);
      }
    }
  }

  /**
   * Set up MutationObserver for theme changes on document
   */
  function setupThemeObserver() {
    if (typeof MutationObserver === "undefined") return;

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var attr = mutations[i].attributeName;
        if (
          attr === "class" ||
          attr === "data-theme" ||
          attr === "data-mode" ||
          attr === "style"
        ) {
          updateAutoThemeWidgets();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-mode", "style"],
    });
  }

  /**
   * Parse configuration from data attributes
   */
  function parseConfig(container) {
    var type = container.getAttribute("data-type") || DEFAULTS.type;
    var theme = container.getAttribute("data-theme") || DEFAULTS.theme;
    var items = DEFAULTS.items; // Always 12 items
    var showFiltersAttr = container.getAttribute("data-show-filters");
    var showFilters =
      showFiltersAttr === null
        ? DEFAULTS.showFilters
        : showFiltersAttr !== "false";
    var showEmojiAttr = container.getAttribute("data-show-emoji");
    var showEmoji =
      showEmojiAttr === null ? DEFAULTS.showEmoji : showEmojiAttr !== "false";
    var text = container.getAttribute("data-text") || null;

    // Validate values
    if (["badge", "preview"].indexOf(type) === -1) type = DEFAULTS.type;
    if (["light", "dark", "auto"].indexOf(theme) === -1) theme = DEFAULTS.theme;

    // Resolve auto theme
    var resolvedTheme = theme === "auto" ? getPreferredTheme() : theme;

    return {
      type: type,
      theme: resolvedTheme,
      items: items,
      showFilters: showFilters,
      showEmoji: showEmoji,
      text: text,
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
  function createBadgeHTML(data, config) {
    var emoji = data.room.emoji;
    var name = escapeHtml(data.room.name);
    var url = escapeHtml(data.roomUrl);
    var customText = config.text;
    var showEmoji = config.showEmoji;

    var parts = [
      "<style>" + STYLES + "</style>",
      '<a class="abode-badge" href="' +
        url +
        '" target="_blank" rel="noopener noreferrer">',
    ];
    // Show emoji if enabled (regardless of custom text)
    if (emoji && showEmoji) {
      parts.push('  <span class="abode-badge-emoji">' + emoji + "</span>");
    }
    // Show custom text or room name
    if (customText) {
      parts.push(
        '  <span class="abode-badge-name">' +
          escapeHtml(customText) +
          "</span>",
      );
    } else {
      parts.push('  <span class="abode-badge-name">' + name + "</span>");
    }
    parts.push("</a>");
    return parts.join("");
  }

  /**
   * Create preview widget HTML
   */
  function createPreviewHTML(data, config) {
    var emoji = data.room.emoji;
    var name = escapeHtml(data.room.name);
    var username = escapeHtml(data.owner.username);
    var count = data.room.itemCount;
    var roomUrl = escapeHtml(data.roomUrl);
    var profileUrl = API_BASE + "/@" + username;
    var items = data.items;

    // Build item grid - only show items that have images
    var gridItems = [];
    for (var i = 0; i < items.length && gridItems.length < config.items; i++) {
      if (items[i] && items[i].imageUrl) {
        var imgUrl = API_BASE + items[i].imageUrl;
        var title = escapeHtml(items[i].title || "");
        var width = items[i].width || 1;
        var height = items[i].height || 1;
        var aspectRatio = width + "/" + height;
        gridItems.push(
          '<div class="abode-preview-item">' +
            '<img src="' +
            imgUrl +
            '" alt="' +
            title +
            '" loading="lazy" style="aspect-ratio:' +
            aspectRatio +
            ';" />' +
            "</div>",
        );
      }
    }

    var emojiHtml =
      emoji && config.showEmoji
        ? '<span class="abode-preview-emoji">' + emoji + "</span>"
        : "";

    // Inline SVG logo
    var logoSvg =
      '<svg role="img" aria-label="abode" width="158" height="50" viewBox="0 0 158 50" fill="none" xmlns="http://www.w3.org/2000/svg"><title>abode</title><path d="M148.373 17.7579C149.824 17.5708 151.134 17.6176 152.304 17.8983C153.006 18.0855 153.731 18.3428 154.48 18.6704C156.164 19.5126 157.241 20.7526 157.709 22.3904C157.802 22.7179 157.849 23.256 157.849 24.0047C157.849 24.8469 157.802 25.4319 157.709 25.7594C157.287 27.1632 156.609 28.3798 155.673 29.4092C154.363 30.7194 152.398 31.7254 149.777 32.4273C147.625 32.942 144.7 33.2695 141.004 33.4099H139.319L139.179 33.831C138.711 36.4046 138.477 37.6446 138.477 37.551C138.243 39.2355 138.22 40.7329 138.407 42.0431C138.921 44.5231 140.302 45.88 142.548 46.114C142.735 46.1608 142.946 46.1842 143.18 46.1842C145.613 46.1842 147.952 45.5057 150.198 44.1487C151.321 43.4936 152.468 42.5812 153.638 41.4114C154.48 40.5691 155.065 40.1948 155.392 40.2884L156.375 41.271C157.03 42.0197 157.287 42.5578 157.147 42.8853C156.913 43.3065 156.118 44.1487 154.761 45.4121C152.515 47.1434 149.894 48.3366 146.9 48.9917C145.73 49.2725 144.349 49.4128 142.758 49.4128C141.308 49.4128 140.091 49.2491 139.109 48.9215C137.705 48.4068 136.441 47.6114 135.318 46.5351C134.476 45.6461 133.821 44.6868 133.353 43.6574C132.464 41.9261 131.949 39.8672 131.809 37.4808C131.669 32.708 133.049 28.4967 135.95 24.8469C136.839 23.7239 137.822 22.7647 138.898 21.9692C141.706 19.6764 144.864 18.2726 148.373 17.7579ZM150.69 21.127C148.724 20.7526 146.783 21.2206 144.864 22.5307C143.18 23.607 141.869 25.3383 140.934 27.7247C140.419 28.9881 140.161 29.7601 140.161 30.0409C140.161 30.228 141.846 30.1813 145.215 29.9005C145.543 29.9005 145.823 29.8771 146.057 29.8303C149.146 29.5028 151.275 28.6371 152.444 27.2333C152.959 26.5783 153.287 25.8062 153.427 24.9171C153.661 23.2326 153.053 22.0628 151.602 21.4077C151.321 21.2673 151.017 21.1738 150.69 21.127Z" fill="currentColor"/><path d="M124.107 0.421129C127.757 0.140376 129.558 0 129.511 0C129.932 0 130.213 0.163772 130.354 0.491316C130.4 0.678485 128.716 7.65052 125.3 21.4074L119.966 42.7447C119.872 43.8209 119.872 44.6865 119.966 45.3416C120.059 45.5756 120.2 45.7628 120.387 45.9031C120.527 46.0435 120.738 46.1137 121.019 46.1137C121.346 46.1137 121.603 46.0669 121.791 45.9733C122.68 45.3182 123.592 43.1892 124.528 39.5862C124.762 38.6971 124.949 38.2058 125.089 38.1122C125.183 38.0187 125.745 37.9719 126.774 37.9719C127.803 37.9719 128.388 38.0187 128.529 38.1122C128.622 38.2058 128.669 38.393 128.669 38.6737C128.669 38.9545 128.552 39.516 128.318 40.3583C126.587 46.2541 124.13 49.2956 120.948 49.4827C118.562 49.6231 116.643 48.8043 115.193 47.0262C114.959 46.7454 114.748 46.4413 114.561 46.1137C114.468 45.833 114.397 45.6926 114.351 45.6926L113.859 46.1137C112.222 47.5643 110.607 48.5235 109.016 48.9914C105.975 50.0209 103.237 49.5529 100.804 47.5877C100.524 47.3537 100.266 47.0963 100.032 46.8156C99.3304 46.1137 98.7454 45.2714 98.2775 44.2888C97.1077 41.9024 96.7334 39.0715 97.1545 35.796C97.9032 30.4617 100.173 25.9697 103.963 22.3199C106.396 19.9803 109.04 18.5063 111.894 17.898C112.315 17.8044 112.97 17.7576 113.859 17.7576C115.029 17.7576 116.035 17.9448 116.877 18.3191C117.533 18.6467 118.141 19.0912 118.702 19.6527C119.077 20.0271 119.264 20.1674 119.264 20.0738C119.311 20.0271 119.896 17.781 121.019 13.3358C122.095 8.9841 122.656 6.55091 122.703 6.03619C122.703 5.61506 122.656 5.3577 122.563 5.26412C122.235 4.93657 121.229 4.74941 119.545 4.70261C118.422 4.70261 117.766 4.53884 117.579 4.2113L117.509 4.00073L117.86 2.59697C118.047 1.70791 118.234 1.1698 118.422 0.982636C118.562 0.842259 118.702 0.77207 118.843 0.77207L124.107 0.421129ZM114.14 21.0565C112.222 20.7289 110.373 21.6414 108.595 23.7938C108.127 24.4021 107.706 25.0572 107.332 25.7591C106.63 27.1161 105.788 29.7832 104.805 33.7606C104.197 36.0066 103.752 37.9719 103.471 39.6564C103.284 41.2473 103.284 42.4639 103.471 43.3062C103.939 44.9439 104.852 45.8797 106.209 46.1137C107.004 46.2541 107.964 46.0903 109.087 45.6224C110.771 44.6865 112.362 43.119 113.859 40.9198L114.21 40.4285L115.965 33.4096L117.72 26.3908L117.579 25.8995C117.158 23.2323 116.129 21.6414 114.491 21.1267C114.397 21.0799 114.28 21.0565 114.14 21.0565Z" fill="currentColor"/><path d="M81.4501 17.7578C81.5437 17.711 82.035 17.6876 82.9241 17.6876C84.1875 17.7344 85.3105 17.9216 86.2931 18.2491C90.1769 19.5593 92.5867 22.3902 93.5225 26.7419C93.6161 27.3034 93.6629 28.1925 93.6629 29.4091C93.7097 30.9532 93.5693 32.357 93.2418 33.6204C92.5867 36.2407 91.4637 38.6739 89.8727 40.9199C86.9716 44.9909 83.3452 47.658 78.9935 48.9214C77.8237 49.249 76.6773 49.4361 75.5543 49.4829C71.5302 49.6233 68.4419 48.1727 66.2895 45.1312C66.0087 44.8037 65.7747 44.4528 65.5876 44.0784C63.3415 40.0543 63.4117 35.3283 65.7981 29.9004C66.9212 27.4672 68.4185 25.3148 70.2902 23.4431C72.0683 21.665 73.9166 20.3314 75.8351 19.4423C77.7068 18.5065 79.5784 17.945 81.4501 17.7578ZM83.626 21.1269C82.6433 20.9865 81.8479 20.9631 81.2396 21.0567C78.9468 21.4778 77.0517 22.6008 75.5543 24.4257C74.1973 26.0634 73.0275 28.8008 72.0449 32.6377C71.9513 32.9653 71.8577 33.2928 71.7641 33.6204C71.0155 36.7087 70.6411 39.0015 70.6411 40.4988C70.6411 41.4815 70.6879 42.1365 70.7815 42.4641C71.343 44.6633 72.7 45.8799 74.8524 46.1139C75.7883 46.2075 76.7709 46.0905 77.8003 45.7629C80.2803 44.9675 82.2456 43.166 83.6962 40.3584C84.4916 38.9079 85.2871 36.5215 86.0826 33.1992C87.112 29.1283 87.3927 26.2272 86.9248 24.4959C86.4569 22.7646 85.3573 21.6416 83.626 21.1269Z" fill="currentColor"/><path d="M43.6915 0.421129C47.3413 0.140376 49.1428 0 49.096 0C49.5172 0 49.7979 0.163772 49.9383 0.491316C49.9851 0.678485 49.213 3.95394 47.6221 10.3177L45.2357 19.9335L45.9376 19.5123C47.9964 18.249 49.9617 17.6407 51.8334 17.6874C54.8281 17.8278 57.1209 19.1146 58.7118 21.5478C59.4605 22.6708 60.0454 24.0044 60.4665 25.5485C60.9345 27.9349 60.8877 30.3681 60.3262 32.8481C59.6243 36.4979 58.1035 39.7734 55.7639 42.6745C54.7813 43.9379 53.7519 44.9907 52.6756 45.833C50.6168 47.5643 48.3474 48.7107 45.8674 49.2722C45.4462 49.3658 44.7912 49.4126 43.9021 49.4126C43.0131 49.4126 42.3346 49.3658 41.8666 49.2722C40.884 49.0382 39.9248 48.5937 38.9889 47.9386C37.8191 47.0963 36.9301 46.0435 36.3218 44.7801C35.6667 43.4232 35.2222 41.9492 34.9882 40.3583C34.8478 39.0949 34.8712 37.5741 35.0584 35.796C35.152 35.0941 36.4154 29.8768 38.8485 20.144C41.2349 10.5984 42.3346 5.63846 42.1474 5.26412C41.8199 4.93657 40.8138 4.74941 39.1293 4.70261C38.0063 4.70261 37.3512 4.53884 37.164 4.2113L37.0938 4.00073L37.4448 2.59697C37.632 1.70791 37.8191 1.1698 38.0063 0.982636C38.1467 0.842259 38.287 0.77207 38.4274 0.77207L43.6915 0.421129ZM52.0439 21.1969C51.6228 21.0097 50.9443 20.9629 50.0085 21.0565C48.6515 21.4308 47.2711 22.3433 45.8674 23.7938C45.1187 24.5425 44.4168 25.4316 43.7617 26.461C43.6681 26.5546 43.2236 28.0753 42.4281 31.0232L41.0946 36.4277C40.1587 40.8262 40.4161 43.7273 41.8666 45.1311C42.2878 45.599 42.8025 45.9031 43.4108 46.0435C44.9081 46.4646 46.4757 45.9265 48.1134 44.4292C49.6107 43.1658 50.8273 40.9666 51.7632 37.8315C52.0907 36.7553 52.4651 35.3749 52.8862 33.6904C53.8688 29.713 54.3602 26.9757 54.3602 25.4783C54.3602 24.4957 54.2432 23.7236 54.0092 23.1621C53.6817 22.2263 53.0266 21.5712 52.0439 21.1969Z" fill="currentColor"/><path d="M15.7046 17.7578L17.1084 17.6876H17.1786C18.208 17.7344 19.1205 17.9684 19.9159 18.3895C20.7114 18.7638 21.4133 19.2786 22.0216 19.9336L22.5831 20.4952L23.0042 20.1442C24.1272 19.068 25.3438 18.7872 26.654 19.302C27.3091 19.5359 27.7536 19.9336 27.9876 20.4952C28.1747 21.0099 28.128 21.9223 27.8472 23.2325C27.6132 24.2619 26.888 27.163 25.6714 31.9358C23.9868 38.7675 23.1212 42.3237 23.0744 42.6045C22.8872 43.9146 22.8638 44.8271 23.0042 45.3418C23.0978 45.5758 23.2382 45.7629 23.4253 45.9033C23.5657 46.0437 23.7763 46.1139 24.057 46.1139C24.3846 46.1139 24.6419 46.0671 24.8291 45.9735C25.7182 45.3184 26.6306 43.1894 27.5665 39.5864C27.8004 38.6973 27.9876 38.206 28.128 38.1124C28.2215 38.0188 28.783 37.972 29.8125 37.972C30.8419 37.972 31.4268 38.0188 31.5672 38.1124C31.6608 38.206 31.7076 38.3932 31.7076 38.6739C31.7076 38.9547 31.5906 39.5162 31.3566 40.3584C29.6253 46.2543 27.1687 49.2958 23.9868 49.4829C21.6004 49.6233 19.682 48.8044 18.2314 47.0263C17.9974 46.7456 17.7869 46.4414 17.5997 46.1139C17.5061 45.8331 17.4359 45.6928 17.3891 45.6928L16.8978 46.1139C15.2601 47.5644 13.6458 48.5237 12.0548 48.9916C9.01335 50.021 6.276 49.5531 3.84281 47.5878C3.56206 47.3539 3.3047 47.0965 3.07074 46.8158C2.36885 46.1139 1.78395 45.2716 1.31603 44.289C-0.0877359 41.4347 -0.368488 38.089 0.473771 34.2521C1.54999 29.1517 3.98319 24.9404 7.77335 21.6182C10.3001 19.4189 12.9439 18.1321 15.7046 17.7578ZM17.1786 21.0567C15.2601 20.7291 13.4118 21.6416 11.6337 23.794C11.1658 24.4023 10.7447 25.0574 10.3703 25.7593C9.66844 27.1163 8.82618 29.7834 7.84354 33.7607C7.23524 36.0068 6.79072 37.972 6.50996 39.6566C6.32279 41.2475 6.32279 42.4641 6.50996 43.3063C6.97789 44.9441 7.89033 45.8799 9.24731 46.1139C10.0428 46.2543 11.002 46.0905 12.125 45.6226C13.8095 44.6867 15.4005 43.1192 16.8978 40.9199L17.2488 40.4286L19.0035 33.48L20.7582 26.4612L20.6178 25.8997C20.1967 23.2325 19.1439 21.6416 17.4593 21.1269C17.3658 21.0801 17.2722 21.0567 17.1786 21.0567Z" fill="currentColor"/></svg>';

    // Build filters HTML
    var filters = data.room.filters || [];
    var filtersHtml = "";
    if (config.showFilters && filters.length > 0) {
      var filterChips = [];
      for (var j = 0; j < filters.length; j++) {
        var f = filters[j];
        var icon = FILTER_ICONS[f.type] || "";
        var prefix = f.negated ? "NOT " : "";

        // Format value based on date operator
        var displayValue = f.value;
        if (f.type === "date" && f.dateOperator) {
          switch (f.dateOperator) {
            case "after":
              displayValue = ">" + f.value;
              break;
            case "before":
              displayValue = "<" + f.value;
              break;
            case "between":
              displayValue = f.value + ".." + (f.endDate || "");
              break;
          }
        }

        filterChips.push(
          '<span class="abode-filter">' +
            icon +
            " " +
            prefix +
            escapeHtml(displayValue) +
            "</span>",
        );
      }
      filtersHtml =
        '<div class="abode-filters">' + filterChips.join("") + "</div>";
    }

    var mutedColor = config.theme === "dark" ? "#a3a3a3" : "#737373";

    return [
      "<style>" + STYLES + "</style>",
      '<div class="abode-preview">',
      '  <div class="abode-preview-header-row">',
      '    <div class="abode-preview-header">',
      emojiHtml,
      '      <div class="abode-preview-info">',
      '        <a class="abode-preview-name" href="' +
        roomUrl +
        '" target="_blank" rel="noopener noreferrer">' +
        name +
        "</a>",
      '        <span class="abode-preview-meta">by ' +
        '<a class="abode-preview-username" href="' +
        profileUrl +
        '" target="_blank" rel="noopener noreferrer">@' +
        username +
        "</a>" +
        " &middot; " +
        count +
        " items</span>",
      filtersHtml,
      "      </div>",
      "    </div>",
      '    <div class="abode-preview-right">',
      '      <a class="abode-logo" href="https://www.abode.fyi" target="_blank" rel="noopener noreferrer" aria-label="Powered by Abode" style="color:' +
        mutedColor +
        '">' +
        logoSvg +
        "</a>",
      "    </div>",
      "  </div>",
      '  <a class="abode-preview-grid-link" href="' +
        roomUrl +
        '" target="_blank" rel="noopener noreferrer">',
      '    <div class="abode-preview-grid-container">',
      '      <div class="abode-preview-grid">',
      "        " + gridItems.join("\n        "),
      "      </div>",
      '      <div class="abode-preview-fade"></div>',
      "    </div>",
      "  </a>",
      "</div>",
    ]
      .filter(Boolean)
      .join("\n");
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

    // Track auto-theme widgets for live updates
    var requestedTheme = container.getAttribute("data-theme") || DEFAULTS.theme;
    if (requestedTheme === "auto" && autoThemeWidgets.indexOf(container) === -1) {
      autoThemeWidgets.push(container);
    }

    // Set theme attribute on container for CSS targeting
    container.setAttribute("data-theme", config.theme);

    // Create shadow DOM
    var shadow;
    try {
      shadow = container.attachShadow({ mode: "closed" });
    } catch (e) {
      // Shadow DOM might already be attached or not supported
      console.warn("Abode widget: Could not attach shadow DOM", e);
      return;
    }

    // Check for pre-loaded data (used by in-app preview)
    var preloadedJson = container.getAttribute("data-room-json");
    if (preloadedJson) {
      try {
        var data = JSON.parse(preloadedJson);
        if (config.type === "preview") {
          shadow.innerHTML = createPreviewHTML(data, config);
        } else {
          shadow.innerHTML = createBadgeHTML(data, config);
        }
        return;
      } catch (e) {
        console.warn("Abode widget: Failed to parse pre-loaded data", e);
        // Fall through to fetch
      }
    }

    // Show loading state
    shadow.innerHTML = createLoadingHTML();

    // Fetch and render
    fetchRoomData(roomId, config.items)
      .then((data) => {
        if (config.type === "preview") {
          shadow.innerHTML = createPreviewHTML(data, config);
        } else {
          shadow.innerHTML = createBadgeHTML(data, config);
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

    // Set up observer for theme changes (only once)
    setupThemeObserver();
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose version for debugging
  window.ABODE_EMBED_VERSION = ABODE_EMBED_VERSION;

  // Expose render function for dynamic widget creation (used by in-app preview)
  window.ABODE_RENDER_WIDGET = renderWidget;
})();
