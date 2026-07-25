import { describe, expect, it } from "vitest";
import {
  classifyFailureReason,
  FetchError,
  ProcessingFailure,
  reasonFromStatus,
} from "./processing-error";

describe("classifyFailureReason", () => {
  it("maps 401/403/429 to source_blocked", () => {
    expect(classifyFailureReason(new FetchError(401))).toBe("source_blocked");
    expect(classifyFailureReason(new FetchError(403))).toBe("source_blocked");
    expect(classifyFailureReason(new FetchError(429))).toBe("source_blocked");
  });

  it("maps 404/410 to source_not_found", () => {
    expect(classifyFailureReason(new FetchError(404))).toBe("source_not_found");
    expect(classifyFailureReason(new FetchError(410))).toBe("source_not_found");
  });

  it("maps 5xx and other statuses to source_unreachable", () => {
    expect(classifyFailureReason(new FetchError(500))).toBe(
      "source_unreachable",
    );
    expect(classifyFailureReason(new FetchError(503))).toBe(
      "source_unreachable",
    );
  });

  it("returns the reason verbatim for a ProcessingFailure", () => {
    expect(
      classifyFailureReason(new ProcessingFailure("unsupported_content")),
    ).toBe("unsupported_content");
    expect(classifyFailureReason(new ProcessingFailure("source_blocked"))).toBe(
      "source_blocked",
    );
  });

  it("maps network-level failures to source_unreachable", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(classifyFailureReason(abort)).toBe("source_unreachable");

    const dns = Object.assign(new Error("getaddrinfo ENOTFOUND"), {
      code: "ENOTFOUND",
    });
    expect(classifyFailureReason(dns)).toBe("source_unreachable");

    const undici = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
    });
    expect(classifyFailureReason(undici)).toBe("source_unreachable");
  });

  it("parses legacy 'Failed to fetch URL: <status>' errors", () => {
    expect(classifyFailureReason(new Error("Failed to fetch URL: 403"))).toBe(
      "source_blocked",
    );
    expect(classifyFailureReason(new Error("Failed to fetch URL: 404"))).toBe(
      "source_not_found",
    );
  });

  it("falls back to unknown for unrecognised errors", () => {
    expect(classifyFailureReason(new Error("something odd"))).toBe("unknown");
    expect(classifyFailureReason("not even an error")).toBe("unknown");
    expect(classifyFailureReason(null)).toBe("unknown");
  });

  it("never leaks raw error text (returns a closed vocabulary)", () => {
    const validReasons = new Set([
      "source_blocked",
      "source_not_found",
      "source_unreachable",
      "unsupported_content",
      "unknown",
    ]);
    const secretUrl = "https://x.com/a?unlocked_article_code=SECRET_TOKEN";
    expect(
      validReasons.has(classifyFailureReason(new FetchError(403, secretUrl))),
    ).toBe(true);
  });
});

describe("reasonFromStatus", () => {
  it("maps HTTP status codes to reason codes", () => {
    expect(reasonFromStatus(403)).toBe("source_blocked");
    expect(reasonFromStatus(429)).toBe("source_blocked");
    expect(reasonFromStatus(404)).toBe("source_not_found");
    expect(reasonFromStatus(410)).toBe("source_not_found");
    expect(reasonFromStatus(500)).toBe("source_unreachable");
  });
});
