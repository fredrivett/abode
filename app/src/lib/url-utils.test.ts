import { describe, expect, it } from "vitest";
import {
  getExtensionFromContentType,
  getHostname,
  getSafeRedirectPath,
  isImageUrl,
  isValidUrl,
  normalizeWebsiteUrl,
} from "./url-utils";

describe("isValidUrl", () => {
  it("returns true for valid http URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
    expect(isValidUrl("http://example.com/path")).toBe(true);
    expect(isValidUrl("http://example.com/path?query=1")).toBe(true);
  });

  it("returns true for valid https URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("https://example.com/path")).toBe(true);
    expect(isValidUrl("https://example.com/path?query=1")).toBe(true);
  });

  it("returns false for invalid URLs", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("example.com")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("   ")).toBe(false);
  });

  it("returns false for non-http protocols", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("file:///path/to/file")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("data:text/html,<h1>Test</h1>")).toBe(false);
  });
});

describe("normalizeWebsiteUrl", () => {
  it("keeps valid http(s) URLs as-is", () => {
    expect(normalizeWebsiteUrl("https://example.com")).toBe(
      "https://example.com",
    );
    expect(normalizeWebsiteUrl("http://example.com/path")).toBe(
      "http://example.com/path",
    );
  });

  it("prepends https:// when the protocol is missing", () => {
    expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com");
    expect(normalizeWebsiteUrl("www.example.com/path")).toBe(
      "https://www.example.com/path",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeWebsiteUrl("  example.com  ")).toBe("https://example.com");
    expect(normalizeWebsiteUrl(" https://example.com ")).toBe(
      "https://example.com",
    );
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(normalizeWebsiteUrl("")).toBeNull();
    expect(normalizeWebsiteUrl("   ")).toBeNull();
  });

  it("returns null for non-http(s) protocols", () => {
    expect(normalizeWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsiteUrl("ftp://example.com")).toBeNull();
    expect(normalizeWebsiteUrl("mailto:me@example.com")).toBeNull();
  });

  it("returns null for input that can't form a valid URL", () => {
    expect(normalizeWebsiteUrl("not a url")).toBeNull();
  });

  it("does not mistake a host:port for a scheme", () => {
    expect(normalizeWebsiteUrl("example.com:8080")).toBe(
      "https://example.com:8080",
    );
  });

  it("is case-insensitive about the protocol prefix", () => {
    expect(normalizeWebsiteUrl("HTTPS://example.com")).toBe(
      "HTTPS://example.com",
    );
  });
});

describe("isImageUrl", () => {
  describe("detection by content type", () => {
    it("detects common image content types", () => {
      expect(isImageUrl("https://example.com/file", "image/jpeg")).toBe(true);
      expect(isImageUrl("https://example.com/file", "image/png")).toBe(true);
      expect(isImageUrl("https://example.com/file", "image/gif")).toBe(true);
      expect(isImageUrl("https://example.com/file", "image/webp")).toBe(true);
      expect(isImageUrl("https://example.com/file", "image/bmp")).toBe(true);
      expect(isImageUrl("https://example.com/file", "image/svg+xml")).toBe(
        true,
      );
      expect(isImageUrl("https://example.com/file", "image/x-icon")).toBe(true);
    });

    it("handles content type with charset", () => {
      expect(
        isImageUrl("https://example.com/file", "image/jpeg; charset=utf-8"),
      ).toBe(true);
      expect(
        isImageUrl("https://example.com/file", "image/png; charset=utf-8"),
      ).toBe(true);
    });

    it("is case insensitive for content types", () => {
      expect(isImageUrl("https://example.com/file", "IMAGE/JPEG")).toBe(true);
      expect(isImageUrl("https://example.com/file", "Image/Png")).toBe(true);
    });

    it("returns false for non-image content types", () => {
      expect(isImageUrl("https://example.com/file", "text/html")).toBe(false);
      expect(isImageUrl("https://example.com/file", "application/json")).toBe(
        false,
      );
      expect(isImageUrl("https://example.com/file", "application/pdf")).toBe(
        false,
      );
    });
  });

  describe("detection by URL extension", () => {
    it("detects common image extensions", () => {
      expect(isImageUrl("https://example.com/image.jpg")).toBe(true);
      expect(isImageUrl("https://example.com/image.jpeg")).toBe(true);
      expect(isImageUrl("https://example.com/image.png")).toBe(true);
      expect(isImageUrl("https://example.com/image.gif")).toBe(true);
      expect(isImageUrl("https://example.com/image.webp")).toBe(true);
      expect(isImageUrl("https://example.com/image.bmp")).toBe(true);
      expect(isImageUrl("https://example.com/image.svg")).toBe(true);
      expect(isImageUrl("https://example.com/image.ico")).toBe(true);
    });

    it("is case insensitive for extensions", () => {
      expect(isImageUrl("https://example.com/image.JPG")).toBe(true);
      expect(isImageUrl("https://example.com/image.PNG")).toBe(true);
      expect(isImageUrl("https://example.com/image.WEBP")).toBe(true);
    });

    it("handles URLs with query strings", () => {
      expect(isImageUrl("https://example.com/image.jpg?size=large")).toBe(true);
      expect(isImageUrl("https://example.com/image.png?v=123")).toBe(true);
    });

    it("returns false for non-image extensions", () => {
      expect(isImageUrl("https://example.com/page.html")).toBe(false);
      expect(isImageUrl("https://example.com/document.pdf")).toBe(false);
      expect(isImageUrl("https://example.com/script.js")).toBe(false);
    });

    it("returns false for URLs without extensions", () => {
      expect(isImageUrl("https://example.com/page")).toBe(false);
      expect(isImageUrl("https://example.com/")).toBe(false);
    });
  });

  describe("priority of content type over extension", () => {
    it("uses content type when both are available", () => {
      // Content type says image, extension says html
      expect(isImageUrl("https://example.com/page.html", "image/jpeg")).toBe(
        true,
      );
      // Content type says html, extension says image
      expect(isImageUrl("https://example.com/image.jpg", "text/html")).toBe(
        false,
      );
    });
  });

  describe("handles null/undefined content type", () => {
    it("falls back to extension check when content type is null", () => {
      expect(isImageUrl("https://example.com/image.jpg", null)).toBe(true);
      expect(isImageUrl("https://example.com/page.html", null)).toBe(false);
    });

    it("falls back to extension check when content type is undefined", () => {
      expect(isImageUrl("https://example.com/image.jpg", undefined)).toBe(true);
      expect(isImageUrl("https://example.com/page.html", undefined)).toBe(
        false,
      );
    });
  });
});

describe("getHostname", () => {
  it("extracts hostname from valid URLs", () => {
    expect(getHostname("https://example.com")).toBe("example.com");
    expect(getHostname("https://example.com/path")).toBe("example.com");
    expect(getHostname("https://example.com/path?query=1")).toBe("example.com");
    expect(getHostname("http://sub.example.com/page")).toBe("sub.example.com");
  });

  it("handles URLs with ports", () => {
    expect(getHostname("https://example.com:8080/path")).toBe("example.com");
    expect(getHostname("http://localhost:3000")).toBe("localhost");
  });

  it("returns original string for malformed URLs", () => {
    expect(getHostname("not a url")).toBe("not a url");
    expect(getHostname("")).toBe("");
    expect(getHostname("example.com")).toBe("example.com");
  });

  it("returns original string for relative URLs", () => {
    expect(getHostname("/path/to/page")).toBe("/path/to/page");
    expect(getHostname("./relative")).toBe("./relative");
  });
});

describe("getSafeRedirectPath", () => {
  it("returns a same-origin relative path unchanged", () => {
    expect(getSafeRedirectPath("/save?url=https://example.com")).toBe(
      "/save?url=https://example.com",
    );
  });

  it("falls back to /dashboard when next is missing", () => {
    expect(getSafeRedirectPath(undefined)).toBe("/dashboard");
    expect(getSafeRedirectPath(null)).toBe("/dashboard");
    expect(getSafeRedirectPath("")).toBe("/dashboard");
  });

  it("uses a custom fallback when provided", () => {
    expect(getSafeRedirectPath(null, "/home")).toBe("/home");
  });

  it("rejects absolute URLs", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(getSafeRedirectPath("http://evil.com/path")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeRedirectPath("//evil.com")).toBe("/dashboard");
  });

  it("rejects backslash escape tricks", () => {
    expect(getSafeRedirectPath("/\\evil.com")).toBe("/dashboard");
  });

  it("rejects paths that don't start with a slash", () => {
    expect(getSafeRedirectPath("dashboard")).toBe("/dashboard");
  });

  it("takes the first candidate when given an array (repeated query param)", () => {
    expect(getSafeRedirectPath(["/save?url=x", "/other"])).toBe("/save?url=x");
  });

  it("validates the first array element and falls back when unsafe", () => {
    expect(getSafeRedirectPath(["//evil.com", "/safe"])).toBe("/dashboard");
  });

  it("falls back for an empty array", () => {
    expect(getSafeRedirectPath([])).toBe("/dashboard");
  });
});

describe("getExtensionFromContentType", () => {
  it("returns correct extension for common image types", () => {
    expect(getExtensionFromContentType("image/jpeg")).toBe(".jpg");
    expect(getExtensionFromContentType("image/png")).toBe(".png");
    expect(getExtensionFromContentType("image/gif")).toBe(".gif");
    expect(getExtensionFromContentType("image/webp")).toBe(".webp");
    expect(getExtensionFromContentType("image/bmp")).toBe(".bmp");
    expect(getExtensionFromContentType("image/svg+xml")).toBe(".svg");
    expect(getExtensionFromContentType("image/x-icon")).toBe(".ico");
  });

  it("handles content type with charset", () => {
    expect(getExtensionFromContentType("image/jpeg; charset=utf-8")).toBe(
      ".jpg",
    );
    expect(getExtensionFromContentType("image/png; charset=utf-8")).toBe(
      ".png",
    );
  });

  it("defaults to .jpg for unknown types", () => {
    expect(getExtensionFromContentType("application/octet-stream")).toBe(
      ".jpg",
    );
    expect(getExtensionFromContentType("unknown/type")).toBe(".jpg");
  });
});
