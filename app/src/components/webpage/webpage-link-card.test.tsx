import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_RETRY_DELAYS_MS } from "@/lib/image-retry";
import {
  getMonogram,
  getMonogramColor,
  WebpageLinkCard,
} from "./webpage-link-card";

// The favicon is same-origin, so <Img> retries it before giving up; walk it
// through every retry so the card's own fallback runs
function failEveryLoad(container: HTMLElement) {
  for (const delay of IMAGE_RETRY_DELAYS_MS) {
    const img = container.querySelector("img");
    if (!img) throw new Error("expected favicon img to render");
    fireEvent.error(img);
    act(() => vi.advanceTimersByTime(delay));
  }
  const img = container.querySelector("img");
  if (!img) throw new Error("expected favicon img to render");
  fireEvent.error(img);
}
describe("getMonogram", () => {
  it("uses the first alphanumeric character, uppercased", () => {
    expect(getMonogram("fredrivett.com")).toBe("F");
    expect(getMonogram("news.ycombinator.com")).toBe("N");
    expect(getMonogram("3blue1brown.com")).toBe("3");
  });

  it("skips leading non-alphanumeric characters", () => {
    expect(getMonogram("-example.com")).toBe("E");
  });

  it("falls back to '?' when there is no alphanumeric", () => {
    expect(getMonogram("")).toBe("?");
    expect(getMonogram("---")).toBe("?");
  });
});

describe("getMonogramColor", () => {
  it("is deterministic for a given domain", () => {
    expect(getMonogramColor("stripe.com")).toBe(getMonogramColor("stripe.com"));
  });

  it("returns an hsl() string", () => {
    expect(getMonogramColor("stripe.com")).toMatch(/^hsl\(\d+ 55% 42%\)$/);
  });
});

describe("WebpageLinkCard", () => {
  it("shows the www-stripped domain and links to the source in a new tab", () => {
    render(<WebpageLinkCard url="https://www.fredrivett.com/about" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://www.fredrivett.com/about");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("fredrivett.com");
  });

  it("renders the domain monogram", () => {
    render(<WebpageLinkCard url="https://stripe.com" />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("renders the title and description when provided", () => {
    render(
      <WebpageLinkCard
        url="https://example.com"
        title="My page"
        description="A short summary"
      />,
    );
    expect(screen.getByText("My page")).toBeInTheDocument();
    expect(screen.getByText("A short summary")).toBeInTheDocument();
  });

  it("does not render a navigable link for a non-http(s) url", () => {
    // sourceUrl is untrusted — a javascript: scheme must never become an anchor
    render(<WebpageLinkCard url="javascript:alert(1)" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("omits the title and description when absent", () => {
    const { container } = render(<WebpageLinkCard url="https://example.com" />);
    // Only the monogram glyph and the domain link carry text
    expect(container).toHaveTextContent("E");
    expect(container).toHaveTextContent("example.com");
    expect(screen.queryByText("My page")).not.toBeInTheDocument();
  });

  it("renders the favicon in place of the monogram when provided", () => {
    const { container } = render(
      <WebpageLinkCard
        url="https://stripe.com"
        faviconUrl="/api/v1/images/fav.png"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/api/v1/images/fav.png",
    );
    // monogram glyph is not rendered while the favicon is showing
    expect(screen.queryByText("S")).not.toBeInTheDocument();
  });

  describe("when the favicon fails to load", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("falls back to the monogram once retries run out", () => {
      const { container } = render(
        <WebpageLinkCard
          url="https://stripe.com"
          faviconUrl="/api/v1/images/broken.png"
        />,
      );
      const img = container.querySelector("img");
      if (!img) throw new Error("expected favicon img to render");
      fireEvent.error(img);
      // A single failure is retried rather than dropped straight to the monogram
      expect(screen.queryByText("S")).not.toBeInTheDocument();

      failEveryLoad(container);
      expect(screen.getByText("S")).toBeInTheDocument();
      expect(container.querySelector("img")).toBeNull();
    });

    it("shows a newly provided favicon after a prior one failed", () => {
      // A reprocessed item can hand the same mounted card a fresh favicon URL —
      // the earlier failure must not permanently pin it to the monogram
      const { container, rerender } = render(
        <WebpageLinkCard
          url="https://stripe.com"
          faviconUrl="/api/v1/images/old.png"
        />,
      );
      failEveryLoad(container);
      expect(container.querySelector("img")).toBeNull();

      rerender(
        <WebpageLinkCard
          url="https://stripe.com"
          faviconUrl="/api/v1/images/new.png"
        />,
      );
      expect(container.querySelector("img")).toHaveAttribute(
        "src",
        "/api/v1/images/new.png",
      );
    });
  });
});
